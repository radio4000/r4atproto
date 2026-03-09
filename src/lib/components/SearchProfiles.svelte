<script lang="ts">
  import { searchActors, getProfiles } from '$lib/services/r4-service';
  import { Button } from '$lib/components/ui/button';
  import { Card, CardContent } from '$lib/components/ui/card';
  import { Input } from '$lib/components/ui/input';
  import { Search, Loader2, User, AlertCircle } from 'lucide-svelte';
  import StateCard from '$lib/components/ui/state-card.svelte';
  import { locale, translate } from '$lib/i18n';
  import { cn } from '$lib/utils';
  import ProfileHeader from '$lib/components/ProfileHeader.svelte';
  import { FEATURED_PROFILES } from '$lib/config/featured-profiles';

  const props = $props<{ showHeading?: boolean; class?: string }>();
  const showHeading = $derived(props.showHeading ?? true);
  const className = $derived(props.class ?? '');

  let q = $state('');
  let results = $state([]);
  let status = $state('');
  let loading = $state(false);
  let hasSearched = $state(false);
  let featuredProfiles = $state<unknown[]>([]);
  const t = (key, vars = {}) => translate($locale, key, vars);

  // Fetch featured profiles on mount
  getProfiles(FEATURED_PROFILES).then((map) => {
    featuredProfiles = Array.from(map.values());
  }).catch((err) => {
    console.error('Failed to load featured profiles:', err);
  });

  async function executeSearch() {
    if (!q.trim()) return;

    loading = true;
    status = '';
    hasSearched = true;
    try {
      results = await searchActors(q, { limit: 25 });
    } catch (err) {
      status = (err as Error)?.message || String(err);
    } finally {
      loading = false;
    }
  }

  async function search(event) {
    event.preventDefault();
    await executeSearch();
  }
</script>

<div class={cn('space-y-8', className)}>
  {#if showHeading}
    <div class="text-center animate-in space-y-3">
      <h2 class="text-3xl font-bold text-foreground">{t('search.title')}</h2>
      <p class="text-lg text-muted-foreground max-w-2xl mx-auto">{t('search.description')}</p>
    </div>
  {/if}

  <Card class="border border-border shadow-sm">
    <CardContent class="pt-6">
      <form onsubmit={search} class="flex flex-col gap-4 sm:flex-row">
        <div class="relative flex-1">
          <Search class="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            id="search-q"
            name="q"
            type="search"
            bind:value={q}
            placeholder={t('search.placeholder')}
            class="pl-12 h-12 text-base"
            disabled={loading}
          />
        </div>
        <Button type="submit" size="lg" class="px-8 shadow-sm" disabled={loading || !q.trim()}>
          {#if loading}
            <Loader2 class="h-5 w-5 animate-spin" />
          {:else}
            {t('search.submit')}
          {/if}
        </Button>
      </form>
    </CardContent>
  </Card>

  {#if status}
    <StateCard
      icon={AlertCircle}
      title={t('search.errorTitle')}
      description={status}
    >
      {#snippet actions()}
        <Button variant="outline" type="button" onclick={executeSearch} disabled={loading}>
          {t('buttons.tryAgain')}
        </Button>
      {/snippet}
    </StateCard>
  {/if}

  {#if loading}
    <StateCard
      icon={Loader2}
      loading={true}
      title={t('search.loadingTitle')}
      description={t('search.loadingDescription')}
    />
  {:else if results.length > 0}
    <div class="space-y-4">
      {#each results as actor, idx (actor.did || actor.handle || idx)}
        <ProfileHeader
          profile={actor}
          handle={actor.handle}
          size="sm"
          class="border-2"
        />
      {/each}
    </div>
  {:else if !q.trim() && featuredProfiles.length > 0}
    <div class="space-y-4">
      {#each featuredProfiles as actor, idx (actor.did || actor.handle || idx)}
        <ProfileHeader
          profile={actor}
          handle={actor.handle}
          size="sm"
          class="border-2"
        />
      {/each}
    </div>
  {:else if hasSearched && !loading}
    <StateCard
      icon={User}
      title={t('search.emptyTitle')}
      description={t('search.emptyDescription', { query: q })}
    >
      {#snippet actions()}
        <Button
          variant="outline"
          type="button"
          onclick={() => {
            q = '';
            results = [];
            status = '';
            hasSearched = false;
          }}
        >
          {t('search.clear')}
        </Button>
      {/snippet}
    </StateCard>
  {/if}
</div>
