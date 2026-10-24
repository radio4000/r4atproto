<script lang="ts">
  import { page } from '$app/state';
  import { session } from '#lib/state/session.js';
  import NavTabs from '#lib/components/NavTabs.svelte';
  import { User, Palette, Languages, RefreshCw } from 'lucide-svelte';
  import { locale, translate } from '#lib/i18n/index.js';

  const { children } = $props();
  const t = (key, vars = {}) => translate($locale, key, vars);

  const currentPath = $derived(page.url.pathname);
  const isAuthenticated = $derived($session?.did);

  // Filter nav items based on authentication
  const navItems = $derived([
    { href: '/settings/account', label: t('settings.nav.account'), icon: User, isActive: currentPath.startsWith('/settings/account') },
    ...(isAuthenticated ? [
      { href: '/settings/appearance', label: t('settings.nav.appearance'), icon: Palette, isActive: currentPath.startsWith('/settings/appearance') },
      { href: '/settings/sync', label: t('settings.nav.sync'), icon: RefreshCw, isActive: currentPath.startsWith('/settings/sync') },
    ] : []),
    { href: '/settings/language', label: t('settings.nav.language'), icon: Languages, isActive: currentPath.startsWith('/settings/language') },
  ]);
</script>

<div class="container max-w-4xl py-6">
  <div class="mb-6">
    <h1 class="text-3xl font-bold">{t('settings.title')}</h1>
    <p class="text-muted-foreground mt-1">{t('settings.description')}</p>
  </div>

  <!-- Settings Navigation -->
  <div class="mb-6 flex justify-center">
    <NavTabs items={navItems} variant="pills-muted" class="border border-border rounded-full" />
  </div>

  <!-- Settings Content -->
  <div>
    {@render children()}
  </div>
</div>
