<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { getNetworkLatestTracks, type NetworkRadio } from '$lib/services/r4-service';
  import NetworkRadioCard from '$lib/components/NetworkRadioCard.svelte';
  import TrackListSkeleton from '$lib/components/ui/skeleton/TrackListSkeleton.svelte';
  import StateCard from '$lib/components/ui/state-card.svelte';
  import { Button } from '$lib/components/ui/button';
  import { Loader2, AlertCircle, Compass, RefreshCw } from 'lucide-svelte';
  import { locale, translate } from '$lib/i18n';
  import SeoHead from '$lib/components/SeoHead.svelte';

  const TRACKS_PER_USER = 10;
  // Discover radios in small pages so the first paint stays light and the
  // "Load more" pagination is exercised as the network grows.
  const RADIOS_PER_PAGE = 12;

  const t = (key: string, vars = {}) => translate($locale, key, vars);

  let radios = $state<NetworkRadio[]>([]);
  let cursor = $state<string | undefined>(undefined);
  let loading = $state(true);
  let loadingMore = $state(false);
  let error = $state('');
  let loaded = $state(false);

  async function loadInitial() {
    loading = true;
    error = '';
    try {
      const res = await getNetworkLatestTracks({ tracksPerUser: TRACKS_PER_USER, maxUsers: RADIOS_PER_PAGE });
      radios = res.radios;
      cursor = res.cursor;
      loaded = true;
    } catch (err) {
      error = (err as Error)?.message || String(err);
    } finally {
      loading = false;
    }
  }

  async function loadMore() {
    if (!cursor || loadingMore) return;
    loadingMore = true;
    error = '';
    try {
      const res = await getNetworkLatestTracks({ tracksPerUser: TRACKS_PER_USER, maxUsers: RADIOS_PER_PAGE, cursor });
      // De-dupe in case a repo appears across pages.
      const seen = new Set(radios.map((r) => r.did));
      radios = [...radios, ...res.radios.filter((r) => !seen.has(r.did))];
      cursor = res.cursor;
    } catch (err) {
      error = (err as Error)?.message || String(err);
    } finally {
      loadingMore = false;
    }
  }

  onMount(() => {
    if (browser) loadInitial();
  });
</script>

<SeoHead title={t('explore.title')} description={t('explore.description')} />

<div class="container max-w-3xl py-6 lg:py-10 space-y-6">
  <header class="space-y-2 text-center">
    <h1 class="flex items-center justify-center gap-2 text-3xl lg:text-4xl font-bold text-foreground">
      <Compass class="h-7 w-7" />
      {t('explore.title')}
    </h1>
    <p class="text-muted-foreground max-w-xl mx-auto">{t('explore.description')}</p>
    {#if loaded && !loading && radios.length}
      <Button
        variant="ghost"
        size="sm"
        onclick={loadInitial}
        class="gap-2 text-muted-foreground"
        title={t('explore.refresh')}
      >
        <RefreshCw class="h-4 w-4" />
        {t('explore.refresh')}
      </Button>
    {/if}
  </header>

  {#if error && !radios.length}
    <StateCard
      icon={AlertCircle}
      title={t('explore.errorTitle')}
      description={error}
    >
      {#snippet actions()}
        <Button variant="outline" onclick={loadInitial}>{t('buttons.tryAgain')}</Button>
      {/snippet}
    </StateCard>
  {:else if loading}
    <div class="space-y-3">
      <TrackListSkeleton count={6} />
    </div>
  {:else if radios.length}
    <div class="space-y-8">
      {#each radios as radio (radio.did)}
        <NetworkRadioCard {radio} />
      {/each}
    </div>

    {#if error}
      <p class="text-center text-sm text-destructive">{error}</p>
    {/if}

    {#if cursor}
      <div class="flex justify-center pt-2">
        <Button variant="outline" onclick={loadMore} disabled={loadingMore} class="gap-2">
          {#if loadingMore}
            <Loader2 class="h-4 w-4 animate-spin" />
            {t('explore.loadingMore')}
          {:else}
            {t('explore.loadMore')}
          {/if}
        </Button>
      </div>
    {/if}
  {:else}
    <StateCard
      icon={Compass}
      title={t('explore.emptyTitle')}
      description={t('explore.emptyDescription')}
    />
  {/if}
</div>
