<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { player, toggle, next as storeNext, prev, playIndex, toggleShuffle, shuffleCurrentPlaylist } from '$lib/player/store';
  import { useLiveQuery } from '@tanstack/svelte-db';
  import { tracksCollection, removeTrack, loadMoreTracksForDid, getPaginationState } from '$lib/stores/tracks-db';
  import { updateTrackByUri } from '$lib/services/r4-service';
  import { get } from 'svelte/store';
  import { parseTrackUrl, buildEmbedUrl } from '$lib/services/url-patterns';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Play, Pause, SkipForward, SkipBack, ExternalLink, ArrowUpRight, Disc as DiscIcon, ListMusic, X, LayoutList, Shuffle, MoreVertical, Eye, Search } from 'lucide-svelte';
  import { locale, translate } from '$lib/i18n';
  import { cn, menuItemClass, menuTriggerClass } from '$lib/utils';
  import Link from '$lib/components/Link.svelte';
  import Avatar from '$lib/components/Avatar.svelte';
  import { profilesCollection, loadProfile, getProfileFromCache } from '$lib/stores/profiles-db';
  import { buildViewHash, buildEditHash } from '$lib/services/track-uri';
  import { session } from '$lib/state/session';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { Pencil, Trash2 } from 'lucide-svelte';
  let {
    class: classProp = '',
    visible: visibleProp = true,
    mobilePanelOpen = $bindable(false)
  } = $props();
  const extraClass = $derived(classProp);
  const visible = $derived(visibleProp);

  let state = $state({ context: null, customPlaylist: null, index: -1, playing: false, isShuffled: false });
  let current = $state(null);

  // Use live query to get tracks from centralized store when context is profile/author
  const tracksQuery = useLiveQuery(
    (q) => q.from({ tracks: tracksCollection }),
    []
  );

  // Use live query to get profiles from cache
  const profilesQuery = useLiveQuery(
    (q) => q.from({ profiles: profilesCollection }),
    []
  );

  // Derive the actual playlist based on context
  const playlist = $derived.by(() => {
    const ctx = state.context;
    if (!ctx) return [];

    // For profile/author contexts, merge customPlaylist with centralized store
    // This ensures we have tracks immediately, but can also get updates from the store
    if (ctx.type === 'profile' || ctx.type === 'author') {
      const allTracks = tracksQuery.data || [];
      const centralizedTracks = allTracks.filter(track => track.authorDid === ctx.key);

      // If shuffle is active and we have a customPlaylist, use it (it contains the shuffled order)
      // This allows shuffle to work even with centralized tracks
      if (state.isShuffled && state.customPlaylist && state.customPlaylist.length > 0) {
        return state.customPlaylist;
      }

      // Use centralized tracks if available and non-empty, otherwise fall back to customPlaylist
      if (centralizedTracks.length > 0) {
        return centralizedTracks;
      }
      return state.customPlaylist || [];
    }

    // For other contexts (discogs), use custom playlist
    return state.customPlaylist || [];
  });
  let iframeSrc = $state('');
  let iframeProvider = $state('');
  let ytPlayer = $state(null);
  let scWidget = $state(null);
  let vimeoPlayer = $state(null);
  let ytApiReady = $state(null);
  let scApiReady = $state(null);
  let vimeoApiReady = $state(null);
  const isBrowser = typeof window !== 'undefined';
  let ytPlayerReady = $state(false);
  let scWidgetReady = $state(false);
  let vimeoPlayerReady = $state(false);
  let playerIframe = $state<HTMLIFrameElement | null>(null);
  let playerAudio = $state<HTMLAudioElement | null>(null);
  let menuOpen = $state(false);
  let menuRef = $state<HTMLElement | null>(null);
  let triggerRef = $state<HTMLElement | null>(null);
  let trackMenuOpen = $state<number | null>(null);
  let trackMenuPosition = $state<{ top: number; right: number } | null>(null);
  let searchQuery = $state('');
  let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  let playlistContainer = $state<HTMLElement | null>(null);
  let playlistHeight = $state(400);
  const savedDurations = new Map<string, number>();

  /**
   * Custom next() function that checks for more tracks to load
   * before stopping or wrapping around
   */
  async function next() {
    const s = player.get();
    const nextIndex = s.index + 1;

    // Check if we're at the end of the current playlist
    if (nextIndex >= playlist.length) {
      // Check if this is a profile context and if there are more tracks to load
      if (s.context && (s.context.type === 'profile' || s.context.type === 'author')) {
        const paginationStore = getPaginationState(s.context.key);
        const paginationState = get(paginationStore);

        if (paginationState.hasMore && !paginationState.loading) {
          console.log('[Player] End of playlist reached, loading more tracks...');
          try {
            await loadMoreTracksForDid(s.context.key);
            // After loading, continue to next track
            storeNext();
          } catch (err) {
            console.error('[Player] Failed to load more tracks:', err);
            // Stop playing if we can't load more
            player.update(state => ({ ...state, playing: false }));
          }
        } else {
          // No more tracks to load, stop playing
          console.log('[Player] End of playlist reached, no more tracks available');
          player.update(state => ({ ...state, playing: false }));
        }
      } else {
        // Not a profile context (discogs/custom), just stop
        player.update(state => ({ ...state, playing: false }));
      }
    } else {
      // Normal case: just go to next track
      storeNext();
    }
  }

  function toggleMenu() {
    menuOpen = !menuOpen;
  }

  function closeMenu() {
    menuOpen = false;
  }

  function toggleTrackMenu(idx: number, event?: MouseEvent) {
    if (trackMenuOpen === idx) {
      trackMenuOpen = null;
      trackMenuPosition = null;
      return;
    }

    trackMenuOpen = idx;

    // Calculate menu position relative to viewport
    if (event) {
      const target = event.currentTarget as HTMLElement;
      const rect = target.getBoundingClientRect();
      trackMenuPosition = {
        top: rect.bottom + 6, // 6px gap below trigger
        right: window.innerWidth - rect.right
      };
    }
  }

  function closeTrackMenu() {
    trackMenuOpen = null;
    trackMenuPosition = null;
  }

  /**
   * Check if the current user can edit a track
   * User must be logged in and own the track
   */
  function canEditTrack(track: any): boolean {
    if (!$session?.did || !track?.uri) return false;

    // Extract DID from track URI (format: at://did:plc:xxx/collection/rkey)
    const uriMatch = track.uri.match(/^at:\/\/([^\/]+)\//);
    const trackDid = uriMatch?.[1];

    // Also check authorDid if available
    const ownerDid = trackDid || track.authorDid || track.author_did;

    return ownerDid === $session.did;
  }

  function updateDurationState(uri: string, seconds: number) {
    // Update current track snapshot
    current = current && current.uri === uri ? { ...current, duration_seconds: seconds } : current;

    // Update any playlists in the player store that reference this track
    player.update((s) => {
      const apply = (list?: any[] | null) =>
        list ? list.map((track) => (track?.uri === uri ? { ...track, duration_seconds: seconds } : track)) : list;

      return {
        ...s,
        customPlaylist: apply(s.customPlaylist),
        originalPlaylist: apply(s.originalPlaylist),
      };
    });
  }

  async function persistTrackDuration(seconds: number) {
    if (!current?.uri) return;
    if (!canEditTrack(current)) return;

    const rounded = Math.round(seconds);
    if (!Number.isFinite(rounded) || rounded <= 0) return;

    const existing = current.duration_seconds ?? savedDurations.get(current.uri);
    if (existing && Math.abs(existing - rounded) <= 1) return;

    try {
      await updateTrackByUri(current.uri, { duration_seconds: rounded });
      savedDurations.set(current.uri, rounded);
      updateDurationState(current.uri, rounded);
      console.log(`[Player] Saved duration ${rounded}s for track ${current.uri}`);
    } catch (e) {
      console.error('[Player] Failed to save duration to track:', e);
    }
  }

  function captureYouTubeDuration() {
    try {
      if (!ytPlayer?.getDuration || !current) return;
      const seconds = ytPlayer.getDuration?.() || 0;
      if (!seconds || seconds <= 0) return;
      void persistTrackDuration(seconds);
    } catch (e) {
      console.error('[Player] Error capturing YouTube duration:', e);
    }
  }

  async function deleteTrack(uri: string) {
    try {
      await removeTrack(uri);
      closeTrackMenu();
      // For custom playlists, also remove from the playlist
      if (state.customPlaylist) {
        player.update(s => ({
          ...s,
          customPlaylist: s.customPlaylist ? s.customPlaylist.filter(t => t.uri !== uri) : null
        }));
      }
    } catch (err) {
      console.error('Failed to delete track:', err);
    }
  }

  function loadScriptOnce(src, check) {
    return new Promise((resolve, reject) => {
      try {
        if (check && check()) return resolve();
        const s = document.createElement('script');
        s.src = src;
        s.async = true;
        s.onload = () => resolve();
        s.onerror = (e) => reject(new Error('Failed to load ' + src));
        document.head.appendChild(s);
      } catch (e) { reject(e); }
    });
  }

  function ensureYouTubeAPI() {
    if (!ytApiReady) {
      ytApiReady = new Promise((resolve) => {
        const onReady = () => resolve();
        if (window.YT && window.YT.Player) return resolve();
        window.onYouTubeIframeAPIReady = onReady;
        loadScriptOnce('https://www.youtube.com/iframe_api', () => window.YT && window.YT.Player).then(() => {
          if (window.YT && window.YT.Player) resolve();
        }).catch(() => resolve());
      });
    }
    return ytApiReady;
  }

  function ensureSCAPI() {
    if (!scApiReady) {
      scApiReady = loadScriptOnce('https://w.soundcloud.com/player/api.js', () => window.SC && window.SC.Widget);
    }
    return scApiReady;
  }

  function ensureVimeoAPI() {
    if (!vimeoApiReady) {
      vimeoApiReady = loadScriptOnce('https://player.vimeo.com/api/player.js', () => window.Vimeo && window.Vimeo.Player);
    }
    return vimeoApiReady;
  }

  let lastIndex = $state(-1);
  let lastUrl = $state('');
  let lastProvider = $state('');
  let syncingWithIframe = $state(false);

  function cleanupProviders() {
    try { if (ytPlayer && ytPlayer.destroy) ytPlayer.destroy(); } catch {}
    ytPlayer = null;
    ytPlayerReady = false;
    try { if (vimeoPlayer && vimeoPlayer.unload) vimeoPlayer.unload(); } catch {}
    vimeoPlayer = null;
    vimeoPlayerReady = false;
    scWidget = null;
    scWidgetReady = false;
    // Reset tracking variables to ensure iframe rebuilds on next track
    lastUrl = '';
    lastProvider = '';
  }

  function resetAudioElement(el?: HTMLAudioElement | null) {
    if (!el) return;
    try { el.pause(); } catch {}
    el.removeAttribute('src');
    try { el.load(); } catch {}
  }

  function clearIframeSource(el?: HTMLIFrameElement | null) {
    if (!el) return;
    try { el.contentWindow?.postMessage?.({ method: 'pause' }, '*'); } catch {}
    el.removeAttribute('src');
  }

  function setIframeSource(value: string) {
    iframeSrc = value;
  }

  function syncFileAudio(url: string, playing: boolean) {
    if (!playerAudio) return;
    if (playerAudio.src !== url) {
      playerAudio.src = url;
      try { playerAudio.load(); } catch {}
    }
    if (playing) playerAudio.play().catch(() => {});
    else playerAudio.pause();
  }

  const unsub = player.subscribe((s) => {
    state = s;

    // Compute current playlist directly (can't rely on derived in subscription)
    const ctx = s.context;
    let currentPlaylist = [];

    if (ctx) {
      if (ctx.type === 'profile' || ctx.type === 'author') {
        const allTracks = tracksQuery.data || [];
        const centralizedTracks = allTracks.filter(track => track.authorDid === ctx.key);
        currentPlaylist = centralizedTracks.length > 0 ? centralizedTracks : (s.customPlaylist || []);
      } else {
        currentPlaylist = s.customPlaylist || [];
      }
    }

    // Handle playlist bounds
    let actualIndex = s.index;
    if (currentPlaylist.length > 0) {
      if (actualIndex >= currentPlaylist.length) {
        // Don't wrap around - this will be handled by our custom next() function
        // Just clamp to last track for now
        actualIndex = currentPlaylist.length - 1;
      }
    }

    // Get current track from computed playlist
    current = currentPlaylist?.[actualIndex] || null;
    if (actualIndex !== lastIndex) {
      lastIndex = actualIndex;
    }
    if (current) {
      const meta = parseTrackUrl(current.url);
      if (meta?.provider === 'file') {
        // Only cleanup if switching from iframe provider to file
        if (lastProvider !== 'file') {
          cleanupProviders();
          lastProvider = 'file';
        }
        syncFileAudio(meta.url, s.playing);
        setIframeSource('');
        iframeProvider = '';
      } else {
        resetAudioElement(playerAudio);
        const provider = meta?.provider || '';
        const url = meta?.url || '';
        const id = meta?.id || '';
        if (provider !== lastProvider || url !== lastUrl) {
          // Check if we can reuse existing player for same provider
          if (provider === lastProvider && provider && url !== lastUrl) {
            // Same provider, different track - use player API to change media
            if (provider === 'youtube' && ytPlayer && ytPlayerReady && id) {
              // Use YouTube API to load new video without recreating player
              try {
                console.log('[Player] Reusing YouTube player, loading video:', id);
                if (s.playing) {
                  ytPlayer.loadVideoById(id);
                } else {
                  ytPlayer.cueVideoById(id);
                }
                lastUrl = url;
                return; // Skip iframe recreation
              } catch (e) {
                // If API call fails, fall back to iframe recreation
                console.error('[Player] Failed to use YouTube loadVideoById, recreating iframe:', e);
              }
            } else if (provider === 'soundcloud' && scWidget && scWidgetReady) {
              // Use SoundCloud API to load new track without recreating widget
              try {
                console.log('[Player] Reusing SoundCloud widget, loading track:', url);
                scWidget.load(url, {
                  auto_play: s.playing,
                  show_artwork: true,
                  show_playcount: false,
                  show_user: false
                });
                lastUrl = url;
                return; // Skip iframe recreation
              } catch (e) {
                // If API call fails, fall back to iframe recreation
                console.error('[Player] Failed to use SoundCloud load, recreating iframe:', e);
              }
            } else if (provider === 'vimeo' && vimeoPlayer && vimeoPlayerReady && id) {
              // Use Vimeo API to load new video without recreating player
              try {
                console.log('[Player] Reusing Vimeo player, loading video:', id);
                vimeoPlayer.loadVideo(id).then(() => {
                  if (s.playing) {
                    vimeoPlayer.play().catch((e) => { console.error('[Player] Error playing Vimeo video after load:', e); });
                  }
                }).catch((e) => {
                  console.error('[Player] Failed to use Vimeo loadVideo, recreating iframe:', e);
                });
                lastUrl = url;
                return; // Skip iframe recreation
              } catch (e) {
                console.error('[Player] Failed to use Vimeo loadVideo, recreating iframe:', e);
              }
            }
          }
          // Only cleanup if switching to a different provider
          if (provider !== lastProvider && lastProvider !== '') {
            console.log(`[Player] Switching provider from ${lastProvider} to ${provider}, cleaning up`);
            cleanupProviders();
          }
          console.log(`[Player] Creating new ${provider} iframe for:`, url);
          iframeProvider = provider;
          setIframeSource('');
          Promise.resolve().then(() => {
            setIframeSource(buildEmbedUrl(meta, { autoplay: s.playing }) || '');
          });
          lastProvider = provider;
          lastUrl = url;
        } else {
          // Only control iframe if change wasn't triggered by iframe itself
          if (!syncingWithIframe) {
            if (!s.playing) {
              if (provider === 'youtube' && ytPlayerReady && ytPlayer && ytPlayer.getPlayerState && ytPlayer.pauseVideo) {
                const state = ytPlayer.getPlayerState();
                if (state === window.YT?.PlayerState?.PLAYING || state === window.YT?.PlayerState?.BUFFERING) {
                  ytPlayer.pauseVideo();
                }
              }
              if (provider === 'soundcloud' && scWidgetReady && scWidget && scWidget.pause) {
                scWidget.isPaused((paused) => { if (!paused) scWidget.pause(); });
              }
              if (provider === 'vimeo' && vimeoPlayerReady && vimeoPlayer && vimeoPlayer.pause && vimeoPlayer.getPaused) {
                vimeoPlayer.getPaused().then(paused => { if (!paused) vimeoPlayer.pause(); }).catch(() => {});
              }
            } else {
              if (provider === 'youtube' && ytPlayerReady && ytPlayer && ytPlayer.getPlayerState && ytPlayer.playVideo) {
                const state = ytPlayer.getPlayerState();
                if (state === window.YT?.PlayerState?.PAUSED || state === window.YT?.PlayerState?.CUED) {
                  ytPlayer.playVideo();
                }
              }
              if (provider === 'soundcloud' && scWidgetReady && scWidget && scWidget.play) {
                scWidget.isPaused((paused) => { if (paused) scWidget.play(); });
              }
              if (provider === 'vimeo' && vimeoPlayerReady && vimeoPlayer && vimeoPlayer.play && vimeoPlayer.getPaused) {
                vimeoPlayer.getPaused().then(paused => { if (paused) vimeoPlayer.play(); }).catch(() => {});
              }
            }
          }
        }
      }
    }
  });

  onMount(() => () => unsub());

  function onKey(e) {
    if (!current) return;
    // Don't handle keyboard shortcuts if user is typing in an input/textarea
    const target = e.target as HTMLElement;
    if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable) {
      return;
    }
    if (e.key === ' ') { e.preventDefault(); toggle(); }
    if (e.key === 'ArrowRight') next();
    if (e.key === 'ArrowLeft') prev();
    // Add 's' for shuffle
    if (e.key === 's' || e.key === 'S') {
      if (!state.isShuffled && playlist.length > 0) {
        shuffleCurrentPlaylist(playlist);
      } else {
        toggleShuffle();
      }
    }
  }

  onMount(() => {
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  let isDesktop = $state(false);

  onMount(() => {
    if (!isBrowser) return;
    const media = window.matchMedia('(min-width: 1024px)');
    const update = () => {
      isDesktop = media.matches;
      if (media.matches) {
        mobilePanelOpen = false;
      }
    };
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  });

  onMount(() => {
    function handleClick(event: MouseEvent) {
      const target = event.target as HTMLElement;

      // Handle main menu
      if (menuOpen) {
        // Close menu if clicking on a link or outside the menu
        const clickedLink = target.closest('a');
        if (clickedLink && menuRef && menuRef.contains(clickedLink)) {
          // Clicked on a link inside menu - close menu and let link work
          menuOpen = false;
          return;
        }
        if (menuRef && menuRef.contains(target)) return;
        if (triggerRef && triggerRef.contains(target)) return;
        menuOpen = false;
      }

      // Handle track menus - check if click is within any menu or trigger
      if (trackMenuOpen !== null) {
        // Close menu if clicking on a link inside track menu
        const clickedLink = target.closest('a');
        const trackMenu = target.closest('[data-track-menu]');
        if (clickedLink && trackMenu) {
          // Clicked on a link inside track menu - close menu and let link work
          trackMenuOpen = null;
          return;
        }
        if (target.closest('[data-track-menu]') || target.closest('[data-track-menu-trigger]')) {
          return;
        }
        trackMenuOpen = null;
      }
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        menuOpen = false;
        trackMenuOpen = null;
      }
    }
    window.addEventListener('click', handleClick);
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('click', handleClick);
      window.removeEventListener('keydown', handleKey);
    };
  });

  onMount(() => {
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries?.[0];
      if (entry) {
        playlistHeight = Math.max(240, Math.floor(entry.contentRect.height));
      }
    });
    if (playlistContainer) {
      observer.observe(playlistContainer);
    }
    return () => observer.disconnect();
  });

  onDestroy(() => {
    cleanupProviders();
  });

  async function setupIframePlayer(target: HTMLIFrameElement | null) {
    if (!target || !iframeProvider) return;
    if (iframeProvider === 'youtube') {
      await ensureYouTubeAPI();
      if (!window.YT || !window.YT.Player) {
        console.error('[Player] YouTube API not available');
        return;
      }
      if (ytPlayer) { try { ytPlayer.destroy(); } catch (e) { console.warn('[Player] Error destroying YouTube player:', e); } ytPlayer = null; ytPlayerReady = false; }
      ytPlayer = new window.YT.Player(target, {
        events: {
          onReady: () => {
            console.log('[Player] YouTube player ready');
            ytPlayerReady = true;
            captureYouTubeDuration();
            if (state.playing) {
              try { ytPlayer.playVideo(); } catch (e) { console.error('[Player] Error playing YouTube video:', e); }
            }
          },
          onStateChange: (e) => {
            if (e?.data === window.YT.PlayerState.ENDED) next();
            syncingWithIframe = true;
            if (e?.data === window.YT.PlayerState.PLAYING) {
              player.update(s => ({ ...s, playing: true }));
              captureYouTubeDuration();
            }
            if (e?.data === window.YT.PlayerState.PAUSED) player.update(s => ({ ...s, playing: false }));
            setTimeout(() => { syncingWithIframe = false; }, 100);
          },
          onError: (e) => {
            const errorCode = e?.data;
            const errorMessages = {
              2: 'Invalid video ID',
              5: 'HTML5 player error',
              100: 'Video not found or private',
              101: 'Video owner does not allow embedding',
              150: 'Video owner does not allow embedding'
            };
            const errorMsg = errorMessages[errorCode] || `Unknown error (${errorCode})`;
            console.error(`[Player] YouTube error ${errorCode}: ${errorMsg}`, current);

            // Record error for this track (only if user owns it)
            if (current?.uri && canEditTrack(current)) {
              updateTrackByUri(current.uri, { media_error: errorMsg }).catch((e) => {
                console.error('[Player] Failed to save media error to track:', e);
              });
            }

            // Skip to next track
            console.log('[Player] Skipping to next track due to error');
            next();
          }
        }
      });
    } else if (iframeProvider === 'soundcloud') {
      await ensureSCAPI();
      if (!window.SC || !window.SC.Widget) {
        console.error('[Player] SoundCloud API not available');
        return;
      }
      scWidget = window.SC.Widget(target);
      scWidget.bind('finish', () => next());
      scWidget.bind('error', (e) => {
        console.error('[Player] SoundCloud player error:', e, current);

        // Record error for this track (only if user owns it)
        if (current?.uri && canEditTrack(current)) {
          updateTrackByUri(current.uri, { media_error: 'SoundCloud playback error' }).catch((e) => {
            console.error('[Player] Failed to save media error to track:', e);
          });
        }

        // Skip to next track
        console.log('[Player] Skipping to next track due to error');
        next();
      });
      scWidget.bind('play', () => {
        syncingWithIframe = true;
        player.update(s => ({ ...s, playing: true }));
        setTimeout(() => { syncingWithIframe = false; }, 100);
      });
      scWidget.bind('pause', () => {
        syncingWithIframe = true;
        player.update(s => ({ ...s, playing: false }));
        setTimeout(() => { syncingWithIframe = false; }, 100);
      });
      scWidget.bind('ready', () => {
        console.log('[Player] SoundCloud widget ready');
        scWidgetReady = true;
        if (state.playing) {
          try { scWidget.play(); } catch (e) { console.error('[Player] Error playing SoundCloud track:', e); }
        }
      });
    } else if (iframeProvider === 'vimeo') {
      await ensureVimeoAPI();
      if (!window.Vimeo || !window.Vimeo.Player) {
        console.error('[Player] Vimeo API not available');
        return;
      }
      if (vimeoPlayer) { try { vimeoPlayer.unload(); } catch (e) { console.warn('[Player] Error unloading Vimeo player:', e); } vimeoPlayer = null; vimeoPlayerReady = false; }
      vimeoPlayer = new window.Vimeo.Player(target);
      vimeoPlayer.on('loaded', () => {
        console.log('[Player] Vimeo player ready');
        vimeoPlayerReady = true;
        if (state.playing) {
          vimeoPlayer.play().catch((e) => { console.error('[Player] Error playing Vimeo video:', e); });
        }
      });
      vimeoPlayer.on('error', (e) => {
        console.error('[Player] Vimeo player error:', e, current);

        // Record error for this track (only if user owns it)
        if (current?.uri && canEditTrack(current)) {
          const errorMsg = e?.message || 'Vimeo playback error';
          updateTrackByUri(current.uri, { media_error: errorMsg }).catch((e) => {
            console.error('[Player] Failed to save media error to track:', e);
          });
        }

        // Skip to next track
        console.log('[Player] Skipping to next track due to error');
        next();
      });
      vimeoPlayer.on('ended', () => next());
      vimeoPlayer.on('play', () => {
        syncingWithIframe = true;
        player.update(s => ({ ...s, playing: true }));
        setTimeout(() => { syncingWithIframe = false; }, 100);
      });
      vimeoPlayer.on('pause', () => {
        syncingWithIframe = true;
        player.update(s => ({ ...s, playing: false }));
        setTimeout(() => { syncingWithIframe = false; }, 100);
      });
    }
  }

  async function onIframeLoad(event: Event) {
    try {
      const target = event?.currentTarget as HTMLIFrameElement | null;
      if (!target || target !== playerIframe) return;
      await setupIframePlayer(target);
    } catch {}
  }

  const t = (key, vars = {}) => translate($locale, key, vars);

  function openCurrentUrl() {
    if (!current) return;
    const url = parseTrackUrl(current?.url || '')?.url || current?.url || '';
    if (!url) return;
    window.open(url, '_blank', 'noopener');
  }

  function openDiscogsLink(track?: any) {
    const link = track?.discogsUrl || track?.discogs_url;
    if (!link) return;
    window.open(link, '_blank', 'noopener');
  }

  const currentHandle = $derived(
    state.context?.handle ?? current?.authorHandle ?? current?.author_handle ?? undefined
  );

  const discogsUrl = $derived(current?.discogsUrl ?? current?.discogs_url ?? '');
  const sourceTrackUri = $derived(current?.source_track_uri ?? '');
  const sourceTrackHref = $derived.by(() => {
    if (!sourceTrackUri || !currentHandle) return null;
    return buildViewHash(currentHandle, sourceTrackUri);
  });
  const queueCount = $derived(playlist?.length ?? 0);

  // Debounced search query
  let debouncedSearchQuery = $state('');

  function handleSearchInput(value: string) {
    searchQuery = value; // Update immediately for input binding
    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer);
    }
    searchDebounceTimer = setTimeout(() => {
      debouncedSearchQuery = value;
    }, 200);
  }

  // Watch for search query changes and update debounced version
  $effect(() => {
    if (searchQuery === '') {
      debouncedSearchQuery = '';
      if (searchDebounceTimer) {
        clearTimeout(searchDebounceTimer);
      }
    }
  });

  const filteredPlaylist = $derived.by(() => {
    if (!debouncedSearchQuery.trim()) {
      return (playlist || []).map((track, idx) => ({ track, originalIdx: idx }));
    }
    const query = debouncedSearchQuery.toLowerCase();
    return (playlist || [])
      .map((track, idx) => ({ track, originalIdx: idx }))
      .filter(({ track }) => {
        const title = (track?.title || '').toLowerCase();
        const handle = (track?.authorHandle || track?.author_handle || '').toLowerCase();
        const description = (track?.description || '').toLowerCase();
        return title.includes(query) || handle.includes(query) || description.includes(query);
      });
  });

  let profileData = $state(null);
  let lastFetchedHandle = $state('');

  const currentProfileName = $derived(
    profileData?.displayName || current?.authorDisplayName || current?.authorHandle || currentHandle || t('trackItem.untitled')
  );
  const currentTrackTitle = $derived(current?.title || t('trackItem.untitled'));
  const currentTrackHref = $derived.by(() => {
    if (!current?.uri || !currentHandle) return null;
    return buildViewHash(currentHandle, current.uri);
  });

  // Get profile from cache reactively, load if not cached
  $effect(() => {
    if (currentHandle && currentHandle !== lastFetchedHandle) {
      lastFetchedHandle = currentHandle;

      // First, try to get from cache (instant)
      const cached = getProfileFromCache(currentHandle);
      if (cached) {
        profileData = cached;
      }

      // Then load fresh data in background (will update cache)
      loadProfile(currentHandle).then(data => {
        if (currentHandle === lastFetchedHandle) {
          profileData = data;
        }
      }).catch(() => {
        // Keep cached data if fetch fails
        if (!profileData) {
          profileData = null;
        }
      });
    }
  });

  const hasBanner = $derived(!!profileData?.banner);
</script>

{#if current}
  <aside
    class={cn(
      extraClass,
      "flex flex-col transition-all duration-300 px-1 lg:px-0 h-full",
      !visible ? "h-0 w-0 m-0 opacity-0 pointer-events-none overflow-hidden" : "opacity-100"
    )}
    style={visible && !isDesktop ? 'max-height:100dvh;' : ''}
  >
    <section
      class="flex flex-col flex-1 min-h-0 gap-0 border border-foreground bg-card/95 shadow rounded-3xl p-0 w-full overflow-hidden relative"
    >
      {#if hasBanner}
        <div
          class="absolute inset-0 bg-cover bg-center rounded-3xl blur-sm"
          style={`background-image: url(${profileData.banner})`}
        ></div>

      {/if}
      <div class={cn("flex flex-col gap-0 flex-1 min-h-0 relative")}>
        <div class={cn("flex items-start gap-3 px-3 pt-3 pb-2 border-b border-foreground", isDesktop ? "min-w-0" : "justify-between items-start")}>
          <div class="flex items-center gap-3 min-w-0 flex-1">
            <Avatar
              src={profileData?.avatar || ''}
              alt={currentProfileName}
              size={isDesktop ? "md" : "sm"}
              class="shadow-lg shrink-0"
            />
            <div class="min-w-0 flex-1">
              {#if currentTrackHref}
                <Link href={currentTrackHref} class="text-sm font-semibold truncate block hover:text-foreground transition-colors">
                  <span class="inline-block px-1 py-0.5 rounded bg-primary text-background">{currentTrackTitle}</span>
                </Link>
              {:else}
                <p class="text-sm font-semibold truncate">
                  <span class="inline-block px-1 py-0.5 rounded bg-primary text-background">{currentTrackTitle}</span>
                </p>
              {/if}
              {#if currentHandle}
                <Link href={`/@${currentHandle}`} class="text-xs hover:underline transition-colors truncate block">
                  <span class="inline-block px-1 py-0.5 rounded bg-primary text-background">@{currentHandle}</span>
                </Link>
              {:else if state.context?.handle}
                <span class="text-xs truncate block">
                  <span class="inline-block px-1 py-0.5 rounded bg-primary text-background">@{state.context.handle}</span>
                </span>
              {/if}
            </div>
          </div>
          <div class="flex items-center gap-0.5 shrink-0 pr-3">
            <div class="relative">
              <button
                bind:this={triggerRef}
                type="button"
                  class={cn(menuTriggerClass(menuOpen), "h-7 w-7")}
                  onclick={() => toggleMenu()}
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                >
                <MoreVertical class="h-3.5 w-3.5 text-current" />
                  <span class="sr-only">Track options</span>
                </button>
              {#if menuOpen}
                <div
                  bind:this={menuRef}
                  class="absolute right-0 z-[100] mt-1.5 w-48 rounded-md border border-foreground bg-background text-foreground shadow-lg"
                  role="menu"
                >
                  {#if currentHandle && current?.uri}
                    <Link
                      href={buildViewHash(currentHandle, current.uri) || '#'}
                      class={menuItemClass}
                    >
                      <Eye class="h-4 w-4" />
                      View track
                    </Link>
                  {/if}
                  {#if sourceTrackHref}
                    <Link
                      href={sourceTrackHref}
                      class={menuItemClass}
                    >
                      <ArrowUpRight class="h-4 w-4" />
                      {t('trackItem.visitSource')}
                    </Link>
                  {/if}
                  {#if current?.url}
                    <a
                      href={current.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      class={menuItemClass}
                    >
                      <ExternalLink class="h-4 w-4" />
                      Open media URL
                    </a>
                  {/if}
                  {#if discogsUrl}
                    <a
                      href={discogsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      class={menuItemClass}
                    >
                      <DiscIcon class="h-4 w-4" />
                      Open Discogs
                    </a>
                  {/if}
                </div>
              {/if}
            </div>
          </div>
        </div>

        <div
          class="grid gap-0 flex-1 min-h-0 w-full"
          style="grid-template-columns:repeat(auto-fit,minmax(260px,1fr));"
        >
          <div class="flex flex-col min-h-0 min-w-[16rem] flex-1">
            {#if parseTrackUrl(current.url)?.provider === 'file'}
              <div class="bg-background flex-1 min-h-[220px]">
                <audio
                  bind:this={playerAudio}
                  onended={next}
                  controls
                  class="w-full h-full"
                ></audio>
              </div>
            {:else if iframeSrc}
              <div class="bg-background flex-1 min-h-[220px]">
                <iframe
                  bind:this={playerIframe}
                  src={iframeSrc}
                  title="Embedded player"
                  allow="autoplay; encrypted-media"
                  allowfullscreen
                  onload={onIframeLoad}
                  class="w-full h-full"
                ></iframe>
              </div>
            {/if}
          </div>

          <div class="flex flex-col min-h-0 min-w-[14rem] h-full">
            <div class="p-3">
              <div class="relative">
                <Search class="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder={t('player.searchPlaceholder')}
                  value={searchQuery}
                  oninput={(e) => handleSearchInput((e.target as HTMLInputElement).value)}
                  class="h-9 pl-9 pr-3 text-sm"
                />
              </div>
            </div>
            <div
              class="flex-1 min-h-0 rounded-none border-t border-foreground border-l-0 border-r-0 bg-background overflow-auto"
              bind:this={playlistContainer}
              role="region"
              aria-label={t('player.playlistLabel') || 'Playlist'}
            >
              {#each filteredPlaylist as entry, index (entry.track?.uri || entry.track?.url || index)}
                {@const track = entry?.track}
                {@const originalIdx = entry?.originalIdx ?? index}
                {@const trackHandle = (track?.authorHandle || track?.author_handle || state.context?.handle || '').replace(/^@/, '')}
                {@const trackHref = track?.uri && trackHandle ? buildViewHash(trackHandle, track.uri) : null}
                {@const trackDid = track?.authorDid || track?.author_did || ''}
                {@const isEditable = $session?.did && trackDid && $session.did === trackDid}
                {@const discogsLink = track?.discogsUrl || track?.discogs_url || ''}
                {#if track}
                  <a
                    href={trackHref || '#'}
                    class={cn(
                      "w-full px-2.5 py-2 transition-all duration-150 flex flex-row flex-nowrap gap-2 relative text-sm items-start group border-b border-foreground/10"
                    )}
                      onclick={(e) => {
                        if (!e.metaKey && !e.ctrlKey && !e.shiftKey) {
                          e.preventDefault();
                          playIndex(originalIdx);
                        }
                      }}
                    >
                      <span class="text-[12px] text-muted-foreground font-semibold shrink-0 w-5 text-left pt-0.5">
                        {originalIdx + 1}
                      </span>
                      <div class="flex-1 min-w-0 flex flex-col gap-0.5">
                      <span class={cn(
                          "truncate text-sm font-medium leading-tight transition-colors py-0.5 rounded underline-offset-4",
                          originalIdx === state.index
                            ? "bg-foreground text-background px-1.5"
                            : "text-foreground group-hover:underline"
                        )}>
                          {track.title || t('trackItem.untitled')}
                        </span>
                        {#if track.description}
                          <span class="truncate text-[12px] text-muted-foreground leading-tight">
                            {track.description}
                          </span>
                        {/if}
                      </div>
                      <div class="relative shrink-0">
                        <button
                          data-track-menu-trigger
                          type="button"
                          class={cn(menuTriggerClass(trackMenuOpen === originalIdx), "h-7 w-7")}
                          onclick={(e) => { e.preventDefault(); e.stopPropagation(); toggleTrackMenu(originalIdx, e); }}
                          aria-haspopup="menu"
                          aria-expanded={trackMenuOpen === originalIdx}
                        >
                          <MoreVertical class="h-3.5 w-3.5 text-current" />
                          <span class="sr-only">{t('player.trackOptions')}</span>
                        </button>
                      </div>
                    </a>
                  {/if}
                {/each}
            </div>

            <!-- Track menu portal - rendered outside scroll container -->
            {#if trackMenuOpen !== null && trackMenuPosition}
              {@const menuTrack = filteredPlaylist[trackMenuOpen]?.track}
              {@const menuOriginalIdx = filteredPlaylist[trackMenuOpen]?.originalIdx ?? trackMenuOpen}
              {@const menuTrackHandle = (menuTrack?.authorHandle || menuTrack?.author_handle || state.context?.handle || '').replace(/^@/, '')}
              {@const menuTrackHref = menuTrack?.uri && menuTrackHandle ? buildViewHash(menuTrackHandle, menuTrack.uri) : null}
              {@const menuTrackDid = menuTrack?.authorDid || menuTrack?.author_did || ''}
              {@const menuIsEditable = $session?.did && menuTrackDid && $session.did === menuTrackDid}
              {@const menuDiscogsLink = menuTrack?.discogsUrl || menuTrack?.discogs_url || ''}
              {@const menuSourceTrackUri = menuTrack?.source_track_uri || ''}
              {@const menuSourceTrackHref = menuSourceTrackUri && menuTrackHandle ? buildViewHash(menuTrackHandle, menuSourceTrackUri) : null}
              <div
                data-track-menu
                class="fixed z-[100] w-48 rounded-md border border-foreground bg-background text-foreground shadow-lg"
                style={`top: ${trackMenuPosition.top}px; right: ${trackMenuPosition.right}px;`}
                role="menu"
              >
                {#if menuTrackHref}
                  <Link
                    href={menuTrackHref}
                    class={menuItemClass}
                  >
                    <Eye class="h-4 w-4" />
                    {t('trackItem.view')}
                  </Link>
                {/if}
                {#if menuSourceTrackHref}
                  <Link
                    href={menuSourceTrackHref}
                    class={menuItemClass}
                  >
                    <Eye class="h-4 w-4" />
                    {t('trackItem.visitSource')}
                  </Link>
                {/if}
                {#if menuIsEditable && menuTrack?.uri && menuTrackHandle}
                  <Link
                    href={buildEditHash(menuTrackHandle, menuTrack.uri) || '#'}
                    class={menuItemClass}
                  >
                    <Pencil class="h-4 w-4" />
                    {t('trackItem.edit')}
                  </Link>
                {/if}
                {#if menuTrack?.url}
                  <a
                    href={menuTrack.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    class={menuItemClass}
                  >
                    <ExternalLink class="h-4 w-4" />
                    {t('trackItem.openMediaUrl')}
                  </a>
                {/if}
                {#if menuDiscogsLink}
                  <a
                    href={menuDiscogsLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    class={menuItemClass}
                  >
                    <DiscIcon class="h-4 w-4" />
                    Open Discogs
                  </a>
                {/if}
                {#if menuIsEditable}
                  <button
                    type="button"
                    class={cn(menuItemClass, "text-destructive hover:text-destructive")}
                    onclick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Delete "${menuTrack?.title || 'Untitled'}"?`)) {
                        deleteTrack(menuTrack.uri);
                      } else {
                        closeTrackMenu();
                      }
                    }}
                  >
                    <Trash2 class="h-4 w-4" />
                    {t('trackItem.delete')}
                  </button>
                {/if}
              </div>
            {/if}
          </div>
        </div>
      </div>

        <div class={cn("flex items-center justify-center gap-2 py-2 border-t border-foreground bg-background relative z-10", isDesktop ? '' : 'shrink-0')}>
          <button
            type="button"
            class={cn(
            "flex items-center justify-center h-8 w-8 rounded-full text-sm font-medium transition-all duration-200 border-2 bg-background",
            state.isShuffled
              ? "text-background border-foreground bg-foreground shadow-sm hover:border-background"
              : "text-foreground border-foreground hover:bg-foreground hover:text-background hover:border-background"
          )}
          onclick={() => {
            // If turning shuffle on and we don't have a customPlaylist yet, shuffle the current playlist
            if (!state.isShuffled && playlist.length > 0) {
              shuffleCurrentPlaylist(playlist)
            } else {
              toggleShuffle()
            }
          }}
          aria-label="Shuffle"
        >
          <Shuffle class="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          class="flex items-center justify-center h-8 w-8 rounded-full text-sm font-medium transition-all duration-200 border-2 bg-background text-foreground border-foreground hover:bg-foreground hover:text-background hover:border-background"
          onclick={prev}
          aria-label={t('player.previous')}
        >
          <SkipBack class="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          class={cn(
            "flex items-center justify-center h-10 w-10 rounded-full text-sm font-medium transition-all duration-200 border-2 bg-background",
            state.playing
              ? "text-background border-foreground bg-foreground shadow-sm hover:border-background"
              : "text-foreground border-foreground hover:bg-foreground hover:text-background hover:border-background"
          )}
          onclick={toggle}
          aria-label={t('player.toggle')}
        >
          {#if state.playing}
            <Pause class="h-4 w-4" />
          {:else}
            <Play class="h-4 w-4" />
          {/if}
        </button>
        <button
          type="button"
          class="flex items-center justify-center h-8 w-8 rounded-full text-sm font-medium transition-all duration-200 border-2 bg-background text-foreground border-foreground hover:bg-foreground hover:text-background hover:border-background"
          onclick={next}
          aria-label={t('player.next')}
        >
          <SkipForward class="h-3.5 w-3.5" />
        </button>
      </div>
    </section>
  </aside>
{/if}
