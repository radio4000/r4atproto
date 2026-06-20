<script lang="ts">
  import SearchProfiles from '$lib/components/SearchProfiles.svelte';
  import { locale, translate } from '$lib/i18n';
  import { page } from '$app/stores';

  const t = (key, vars = {}) => translate($locale, key, vars);
  const initialQuery = $derived($page.url.searchParams.get('q') ?? '');
</script>

<div class="container max-w-4xl py-8 lg:py-12 space-y-8">
  <div class="text-center animate-in space-y-3">
    <h1 class="text-4xl lg:text-5xl font-bold text-foreground">{t('search.title')}</h1>
    <p class="text-lg text-muted-foreground max-w-2xl mx-auto">{t('search.description')}</p>
  </div>

  <SearchProfiles showHeading={false} {initialQuery} />
</div>
