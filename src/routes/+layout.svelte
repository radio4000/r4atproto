<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { bskyOAuth } from '$lib/services/bsky-oauth';
  import { buildLoopbackClientId } from '@atproto/oauth-client-browser';
  import { session } from '$lib/state/session';
  import { theme } from '$lib/state/theme';
  import { getR4Profile } from '$lib/services/r4-service';
  import Player from '$lib/components/Player.svelte';
  import '../app.css';
  import StateCard from '$lib/components/ui/state-card.svelte';
  import { Loader2, Menu, X, Home, Plus, User, Settings, AtSign, Play, Pause, LayoutList, Radio } from 'lucide-svelte';
  import { player, toggle } from '$lib/player/store';
  import { locale, translate } from '$lib/i18n';
  import { cn } from '$lib/utils';
  import { resolveHandle } from '$lib/services/r4-service';
  import NavTabs from '$lib/components/NavTabs.svelte';
  import { base } from '$app/paths';
  import { browser } from '$app/environment';
  import ToastContainer from '$lib/components/ui/toast/ToastContainer.svelte';
  import SeoHead from '$lib/components/SeoHead.svelte';

  let { children } = $props();
  let ready = $state(false);
  let hasDesktopPlayer = $state(false);
  let playerVisible = $state(true);
  let mobilePanelOpen = $state(true);
  let playerState = $state({ playing: false, customPlaylist: [], context: null, index: -1, isShuffled: false });
  // Legacy modal placeholders to avoid runtime errors from stale navigation state
  let viewModal = $state(null);
  let editModal = $state(null);

  async function initOAuth() {
    try {
      const metadataFile = 'client-metadata.json';
      let clientId: string;
      let useFallback = false;
      // Ensure loopback client IDs never include path components
      const loopbackLocation = {
        hostname: window.location.hostname,
        port: window.location.port,
        pathname: '/',
      };

      // Determine which client ID to use
      if (window.location.protocol === 'https:') {
        // For HTTPS, first check if we can reach the metadata
        const metadataUrl = new URL(metadataFile, window.location.origin + base + '/').href;

        try {
          // Quick check if metadata is accessible
          const response = await fetch(metadataUrl, { method: 'HEAD', cache: 'no-cache' });
          if (response.ok) {
            clientId = metadataUrl;
          } else {
            console.warn(`Metadata not accessible (${response.status}), using loopback client`);
            useFallback = true;
          }
        } catch (error) {
          console.warn('Cannot reach metadata URL, using loopback client:', error);
          useFallback = true;
        }

        if (useFallback) {
          clientId = buildLoopbackClientId(loopbackLocation as any);
        }
      } else {
        // For HTTP (localhost), always use loopback client
        clientId = buildLoopbackClientId(loopbackLocation as any);
      }

      await bskyOAuth.init(clientId);

      // Ensure OAuth callback is processed
      try { await bskyOAuth.handleCallback(); } catch (e) { console.error('OAuth callback error:', e); }

      // Try restoring existing session
      try {
        if (!bskyOAuth.session?.did) {
          const did = bskyOAuth.getStoredDid && bskyOAuth.getStoredDid();
          if (did) {
            await bskyOAuth.restoreSession(did);
          }
        }
      } catch (e) { console.error('Session restore error:', e); }

      // Lazy resolve human handle
      if (bskyOAuth.isAuthenticated()) {
        bskyOAuth.resolveHandle().then((_) => { session.refresh(); });
      }

      session.refresh();
    } catch (error) {
      console.error('OAuth initialization error:', error);
    } finally {
      ready = true;
    }
  }

  // Load theme settings from profile
  async function loadThemeFromProfile() {
    if (!$session?.did) {
      console.log('[loadThemeFromProfile] No session DID, skipping');
      return;
    }

    console.log('[loadThemeFromProfile] Loading profile for DID:', $session.did);

    try {
      const profile = await getR4Profile($session.did);
      console.log('[loadThemeFromProfile] Profile loaded:', profile);

      if (profile) {
        console.log('[loadThemeFromProfile] Applying theme from profile');
        theme.setMode(profile.mode);
        theme.setLightColors({
          background: profile.lightBackground,
          foreground: profile.lightForeground,
          accent: profile.lightAccent,
        });
        theme.setDarkColors({
          background: profile.darkBackground,
          foreground: profile.darkForeground,
          accent: profile.darkAccent,
        });
        console.log('[loadThemeFromProfile] Theme applied successfully');
      } else {
        console.log('[loadThemeFromProfile] No profile found, using defaults');
      }
    } catch (error) {
      console.error('[loadThemeFromProfile] Failed to load theme from profile:', error);
    }
  }

  // Apply theme to document using only background/foreground colors
  function applyTheme() {
    if (!browser) return;

    const effectiveMode = $theme.mode === 'auto'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : $theme.mode;

    // Apply dark class
    if (effectiveMode === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    // Apply custom colors (only background/foreground)
    const colors = effectiveMode === 'dark' ? $theme.darkColors : $theme.lightColors;

    const set = (name: string, value: string) => {
      document.documentElement.style.setProperty(name, value);
    };

    set('--background', colors.background);
    set('--foreground', colors.foreground);

    // Map all other tokens to either background or foreground
    set('--muted', colors.background);
    set('--card', colors.background);
    set('--popover', colors.background);
    set('--secondary', colors.background);
    set('--accent', colors.foreground);
    set('--primary', colors.foreground);
    set('--destructive', colors.foreground);
    set('--border', colors.foreground);
    set('--input', colors.foreground);
    set('--ring', colors.foreground);

    set('--card-foreground', colors.foreground);
    set('--popover-foreground', colors.foreground);
    set('--muted-foreground', colors.foreground);
    set('--secondary-foreground', colors.foreground);
    set('--accent-foreground', colors.background);
    set('--primary-foreground', colors.background);
    set('--destructive-foreground', colors.background);
  }

  onMount(() => {
    initOAuth().catch(console.error);
    const unsubscribe = player.subscribe((state) => {
      // Player is active if we have a context (profile/author/discogs) or custom playlist
      hasDesktopPlayer = (state.context !== null || state.customPlaylist?.length > 0) && state.index >= 0;
      playerState = state;
    });

    // Apply theme on mount
    applyTheme();

    // Watch for theme changes
    const themeUnsubscribe = theme.subscribe(() => {
      applyTheme();
    });

    // Watch for session changes to load profile (only way to load)
    const sessionUnsubscribe = session.subscribe((s) => {
      if (s?.did) {
        console.log('[session subscribe] Session updated, loading profile');
        loadThemeFromProfile();
      }
    });

    // Listen for system preference changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if ($theme.mode === 'auto') {
        applyTheme();
      }
    };
    mediaQuery.addEventListener('change', handleChange);

    return () => {
      unsubscribe();
      themeUnsubscribe();
      sessionUnsubscribe();
      mediaQuery.removeEventListener('change', handleChange);
    };
  });

  const t = (key, vars = {}) => translate($locale, key, vars);
  const defaultDescription = $derived(t('home.subtitle') || 'Share and discover music tracks on the AT Protocol.');

  const userHandle = $derived(($session && $session.handle) || '');
  const myPath = $derived(userHandle ? `/@${encodeURIComponent(userHandle)}` : '/');
  const addPath = $derived(userHandle ? `/@${encodeURIComponent(userHandle)}/add` : '/');

  const navItems = $derived.by(() => {
    const currentPath = $page.url.pathname;
    const checkActive = (href: string) => currentPath === (base + href) || currentPath === href;

    const baseItems = [
      { href: '/', label: t('nav.links.home'), icon: Home, isActive: checkActive('/') },
      { href: '/network', label: t('nav.links.network'), icon: Radio, isActive: currentPath.startsWith(base + '/network') || currentPath.startsWith('/network') }
    ];

    if ($session?.did && userHandle) {
      baseItems.push(
        { href: myPath, label: userHandle, icon: AtSign, isActive: checkActive(myPath) },
        { href: addPath, label: t('nav.links.add'), icon: Plus, isActive: checkActive(addPath) }
      );
    }

    baseItems.push(
      { href: '/settings', label: t('nav.links.settings'), icon: Settings, isActive: currentPath.startsWith('/settings') }
    );

    return baseItems;
  });
  const hasPlayback = $derived(
    (playerState.customPlaylist?.length > 0 || playerState.context !== null) &&
    playerState.index >= 0
  );
  const playbackCollapsed = $derived(!hasPlayback || !playerVisible);
</script>

<SeoHead title="Radio4000" description={defaultDescription} />

{#if !ready}
  <div class="flex items-center justify-center min-h-screen p-4">
    <StateCard
      icon={Loader2}
      loading={true}
      title={t('app.loadingTitle')}
      description={t('app.loadingDescription')}
    />
  </div>
{:else}

  <div class="min-h-screen bg-background flex flex-col">
    <div class="flex-1 px-0.5 sm:px-1 lg:px-2">
      <div class="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-center lg:gap-4">
        {#if hasPlayback}
        <section
          class={cn(
            "layout-playback order-1 w-full sticky top-0 z-10 transition-all duration-200 lg:order-2 lg:w-full lg:max-w-lg h-screen",
            playbackCollapsed && "hidden"
          )}
          aria-label="layout-playback"
        >
          <div class="h-full rounded-xl bg-background/95 p-2 lg:p-3 shadow-sm">
            <Player
              visible={!playbackCollapsed}
              bind:mobilePanelOpen={mobilePanelOpen}
              class="w-full h-full"
            />
          </div>
        </section>
        {/if}

        <section
          class={cn(
            "layout-panel relative z-20 flex-1 min-w-0 flex flex-col gap-4 order-2 lg:order-1 min-h-screen w-full bg-background/95 rounded-xl",
            playbackCollapsed ? "lg:max-w-5xl lg:mx-auto" : ""
          )}
          aria-label="layout-panel"
        >
          <main class="flex-1 min-h-0 rounded-2xl">
            {@render children()}
          </main>

          <nav class="mt-2 sticky bottom-0 left-0 right-0 z-40 rounded-2xl pb-1">
            <div class="flex items-center justify-center gap-2 flex-wrap">
              <NavTabs items={navItems} variant="pills" />

              {#if hasPlayback}
                <div class="inline-flex gap-1 rounded-full bg-background/95 backdrop-blur-xl border border-border">
                  <button
                    type="button"
                    onclick={toggle}
                    class={cn(
                      "flex items-center justify-center px-3 py-2 rounded-full text-sm font-medium transition-all duration-200",
                      playerState.playing
                        ? "text-background bg-foreground border border-foreground shadow-sm hover:border-background"
                        : "text-foreground border border-foreground hover:bg-foreground hover:text-background hover:border-background"
                    )}
                    aria-label={playerState.playing ? 'Pause' : 'Play'}
                  >
                    {#if playerState.playing}
                      <Pause class="h-3.5 w-3.5" />
                    {:else}
                      <Play class="h-3.5 w-3.5" />
                    {/if}
                  </button>
                  <!-- Never stop playback when hiding the player -->
                  <button
                    type="button"
                    onclick={() => {
                      if (window.innerWidth < 1024) {
                        mobilePanelOpen = !mobilePanelOpen;
                        playerVisible = mobilePanelOpen;
                      } else {
                        playerVisible = !playerVisible;
                      }
                    }}
                    class={cn(
                      "flex items-center justify-center px-3 py-2 rounded-full text-sm font-medium transition-all duration-200",
                      (playerVisible || mobilePanelOpen)
                        ? "text-background bg-foreground border border-foreground shadow-sm hover:border-background"
                        : "text-foreground border border-foreground hover:bg-foreground hover:text-background hover:border-background"
                    )}
                    aria-label="Toggle player visibility"
                  >
                    <LayoutList class="h-3.5 w-3.5" />
                  </button>
               </div>
             {/if}
            </div>
          </nav>
        </section>

      </div>
    </div>
  </div>
{/if}

<!-- Toast Notifications -->
<ToastContainer />
