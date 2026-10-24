<script lang="ts">
  import { listR4FavoritesByDid, getProfiles } from '#lib/services/r4-service.js';
  import { getContext } from 'svelte';
  import ProfileHeader from '#lib/components/ProfileHeader.svelte';
  import { Button } from '#lib/components/ui/button/index.js';
  import { Loader2, AlertCircle, Users } from 'lucide-svelte';
  import StateCard from '#lib/components/ui/state-card.svelte';
  import { locale, translate } from '#lib/i18n/index.js';

  const { data } = $props();

  // Get profile and did from layout context
  const profileContext = getContext('profile');
  const profile = $derived(profileContext?.profile);
  const did = $derived(profileContext?.did);

  let follows = $state([]);
  let profiles = $state(new Map());
  let cursor = $state(undefined);
  let status = $state('');
  let loading = $state(false);
  let loadRequestId = 0;
  const t = (key, vars = {}) => translate($locale, key, vars);

  function refreshFollowing() {
    if (did) {
      loadFollowing(did);
    }
  }

  function dedupeFollows(list: any[] = []) {
    const seen = new Set<string>();
    const result = [];
    for (const follow of list || []) {
      const key = follow?.subject;
      if (!key || seen.has(key)) continue;
      seen.add(key);
      result.push(follow);
    }
    return result;
  }

  function mergeFollows(existing: any[], incoming: any[]) {
    const seen = new Set(existing.map((f) => f?.subject).filter(Boolean));
    const merged = [...existing];
    const added = [];
    for (const follow of incoming || []) {
      const key = follow?.subject;
      if (!key || seen.has(key)) continue;
      seen.add(key);
      merged.push(follow);
      added.push(follow);
    }
    return { merged, added };
  }

  async function loadFollowing(targetDid: string) {
    const requestId = ++loadRequestId;
    loading = true;
    status = '';
    follows = [];
    profiles = new Map();
    cursor = undefined;

    (async () => {
      try {
        const favoritesData = await listR4FavoritesByDid(targetDid);
        if (requestId !== loadRequestId) return;

        follows = dedupeFollows(favoritesData.favorites);
        cursor = favoritesData.cursor;

        // Fetch profiles for all followed DIDs
        if (follows.length > 0) {
          const dids = follows.map(f => f.subject).filter(Boolean);
          const profilesMap = await getProfiles(dids);
          if (requestId !== loadRequestId) return;
          profiles = profilesMap;
        }
      } catch (err) {
        if (requestId === loadRequestId) status = (err as Error)?.message || String(err);
      } finally {
        if (requestId === loadRequestId) loading = false;
      }
    })();
  }

  $effect(() => {
    if (did) {
      loadFollowing(did);
    }
  });

  async function more() {
    if (!cursor || !did) return;
    const { favorites: newFollows = [], cursor: c } = await listR4FavoritesByDid(did, { cursor });
    cursor = c;
    const { merged, added } = mergeFollows(follows, newFollows);
    follows = merged;

    // Fetch profiles for new follows
    if (added.length > 0) {
      const dids = added.map(f => f.subject).filter(Boolean);
      const newProfiles = await getProfiles(dids);
      profiles = new Map([...profiles, ...newProfiles]);
    }
  }
</script>

{#if status}
  <StateCard
    icon={AlertCircle}
    title={t('following.errorTitle')}
    description={status}
    class="mb-6"
  >
    {#snippet actions()}
      <Button variant="outline" onclick={refreshFollowing}>
        {t('buttons.tryAgain')}
      </Button>
    {/snippet}
  </StateCard>
{/if}

{#if loading}
  <StateCard
    icon={Loader2}
    loading={true}
    title={t('following.loadingTitle')}
    description={t('following.loadingDescription')}
  />
{:else if follows.length === 0 && !status}
  <StateCard
    icon={Users}
    title={t('following.emptyTitle')}
    description={t('following.emptyDescription')}
  />
{:else if follows.length > 0}
  <div class="space-y-3" role="region" aria-label="Following list">
    {#each follows as follow (follow.uri || follow.subject)}
      {@const followProfile = profiles.get(follow?.subject)}
      <ProfileHeader
        profile={followProfile}
        handle={followProfile?.handle || follow?.subject}
        size="sm"
      />
    {/each}
  </div>

  {#if cursor && follows.length >= 50}
    <div class="mt-6 text-center">
      <Button variant="outline" onclick={more}>
        {t('following.loadMore')}
      </Button>
    </div>
  {/if}
{/if}
