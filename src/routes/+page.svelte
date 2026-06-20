<script lang="ts">
  import { session } from '$lib/state/session';
  import { getProfile, listR4FavoritesByDid, getProfiles } from '$lib/services/r4-service';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
  import StateCard from '$lib/components/ui/state-card.svelte';
  import ProfileHeader from '$lib/components/ProfileHeader.svelte';
  import SignInForm from '$lib/components/SignInForm.svelte';
  import { Loader2, Users, Search } from 'lucide-svelte';
  import { locale, translate } from '$lib/i18n';
  import SeoHead from '$lib/components/SeoHead.svelte';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';

  let myProfile = $state(null);
  let follows = $state([]);
  let followProfiles = $state(new Map());
  let loadingHome = $state(false);
  let searchQuery = $state('');
  const t = (key, vars = {}) => translate($locale, key, vars);

  function goToSearch(event: SubmitEvent) {
    event.preventDefault();
    const query = searchQuery.trim();
    goto(query ? `${resolve('/search')}?q=${encodeURIComponent(query)}` : resolve('/search'));
  }

  async function loadHomeData() {
    if (!$session?.did || !$session?.handle) return;
    loadingHome = true;
    try {
      const [profile, favoritesData] = await Promise.all([
        getProfile($session.handle),
        listR4FavoritesByDid($session.did, { limit: 10 })
      ]);
      myProfile = profile;
      const uniqueFollows = new Map();
      for (const follow of favoritesData.favorites || []) {
        const key = follow?.subject || follow?.uri;
        if (key && !uniqueFollows.has(key)) {
          uniqueFollows.set(key, follow);
        }
      }
      follows = Array.from(uniqueFollows.values());

      if (follows.length > 0) {
        const dids = follows.map(f => f.subject).filter(Boolean);
        followProfiles = await getProfiles(dids);
      }
    } catch (err) {
      console.error('Failed to load home data:', err);
    } finally {
      loadingHome = false;
    }
  }

  const isAuthenticated = $derived($session && $session.did);

  $effect(() => {
    if (isAuthenticated) {
      loadHomeData();
    }
  });
</script>

<SeoHead title={t('home.title')} description={t('home.subtitle')} />

{#snippet searchBar()}
  <form onsubmit={goToSearch} class="relative" role="search">
    <Search class="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
    <Input
      type="search"
      name="q"
      bind:value={searchQuery}
      placeholder={t('search.placeholder')}
      class="pl-12 pr-24 h-12 text-base"
      aria-label={t('search.title')}
    />
    <Button type="submit" size="sm" class="absolute right-1.5 top-1/2 -translate-y-1/2">
      {t('search.submit')}
    </Button>
  </form>
{/snippet}

{#if isAuthenticated}
  <div class="container max-w-4xl py-4 space-y-6">
    {@render searchBar()}
    {#if loadingHome}
      <div class="flex items-center justify-center min-h-[50vh]">
        <StateCard
          icon={Loader2}
          loading={true}
          title="Loading your profile"
          description="Fetching your profile and favorites."
        />
      </div>
    {:else}
      {#if myProfile && $session?.handle}
        <ProfileHeader
          profile={myProfile}
          handle={$session.handle}
          size="lg"
          class="mb-6"
        />
      {/if}

      {#if follows.length > 0}
        <div class="space-y-3" role="region" aria-label="Your favorite profiles">
          {#each follows as follow (follow.uri || follow.subject)}
            {@const profile = followProfiles.get(follow?.subject)}
            <ProfileHeader
              profile={profile}
              handle={profile?.handle || follow?.subject}
              size="sm"
            />
          {/each}
        </div>
      {:else}
        <Card class="border-2">
          <CardHeader>
            <CardTitle class="flex items-center gap-2">
              <Users class="h-5 w-5" />
              No favorites yet
            </CardTitle>
            <CardDescription>
              Start adding Radio4000 favorites to see them here.
            </CardDescription>
          </CardHeader>
          <CardContent class="flex flex-col sm:flex-row gap-2">
            <Button href="/explore" class="w-full">
              {t('explore.title')}
            </Button>
            <Button href="/search" variant="outline" class="w-full">
              {t('home.exploreProfiles')}
            </Button>
          </CardContent>
        </Card>
      {/if}
    {/if}
  </div>
{:else}
  <div class="container mx-auto max-w-2xl mt-10 px-3 space-y-8">
    <div class="mb-8 text-center space-y-3 animate-in">
      <h1 class="text-4xl font-bold text-gradient">{t('home.title')}</h1>
      <p class="text-lg text-muted-foreground">{t('home.subtitle')}</p>
    </div>

    {@render searchBar()}

    <SignInForm variant="default" />
  </div>
{/if}
