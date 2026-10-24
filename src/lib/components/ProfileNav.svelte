<script lang="ts">
  import { page } from '$app/stores';
  import NavTabs from '$lib/components/NavTabs.svelte';
  import { locale, translate } from '$lib/i18n';
  import { Music, Heart, Plus } from 'lucide-svelte';
  import { base } from '$app/paths';
  import { session } from '$lib/state/session';

  const { handle } = $props();
  const t = (key, vars = {}) => translate($locale, key, vars);

  const currentPath = $derived($page.url.pathname);
  const profilePath = `/@${handle}`;
  const followingPath = `/@${handle}/favorites`;
  const addPath = `/@${handle}/add`;

  const isTracksActive = $derived(
    currentPath === (base + profilePath) ||
    currentPath === profilePath ||
    currentPath.startsWith(`${base}/@${handle}/tracks/`) ||
    currentPath.startsWith(`/@${handle}/tracks/`)
  );
  const isFollowingActive = $derived(currentPath === (base + followingPath) || currentPath === followingPath);
  const isAddActive = $derived(currentPath === (base + addPath) || currentPath === addPath);

  const isOwnProfile = $derived($session?.handle === handle);

  const navItems = $derived([
    { href: profilePath, label: t('profileNav.tracks'), icon: Music, isActive: isTracksActive },
    { href: followingPath, label: t('profileNav.following'), icon: Heart, isActive: isFollowingActive },
    ...(isOwnProfile ? [{ href: addPath, label: t('nav.links.add'), icon: Plus, isActive: isAddActive }] : [])
  ]);
</script>

<div class="flex gap-2 mb-4 justify-center">
  <NavTabs items={navItems} variant="pills-muted" class="border border-border rounded-full" />
</div>
