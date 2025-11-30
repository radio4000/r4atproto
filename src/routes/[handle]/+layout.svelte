<script lang="ts">
  import { resolveHandle } from '$lib/services/r4-service';
  import { setContext } from 'svelte';
  import { useLiveQuery } from '@tanstack/svelte-db';
  import { profilesCollection, loadProfile, getProfileFromCache } from '$lib/stores/profiles-db';
  import FollowButton from '$lib/components/FollowButton.svelte';
  import ProfileHeader from '$lib/components/ProfileHeader.svelte';
  import ProfileNav from '$lib/components/ProfileNav.svelte';
  import TrackEditDialogContent from '$lib/components/TrackEditDialogContent.svelte';
  import Dialog from '$lib/components/ui/Dialog.svelte';
  import { session } from '$lib/state/session';
  import { Button } from '$lib/components/ui/button';
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { Loader2, AlertCircle } from 'lucide-svelte';
  import StateCard from '$lib/components/ui/state-card.svelte';
  import { locale, translate } from '$lib/i18n';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import SeoHead from '$lib/components/SeoHead.svelte';

  const { data, children } = $props();
  const handle = $derived(data?.handle ? data.handle.replace(/^@/, '') : '');
  const normalizedHandle = $derived(handle || '');
  const profileTitle = $derived(profile?.displayName || profile?.handle || (handle ? `@${handle}` : 'Profile'));
  const profileDescription = $derived(profile?.description || t('profile.viewFormDescription'));
  const profileImage = $derived(profile?.avatar || profile?.banner || '');
  const profileFavicon = $derived(profile?.avatar || '/favicon.png');

  // Check if we're on an edit route (segment equals "edit")
  const isEditRoute = $derived.by(() => {
    const parts = ($page.url.pathname || '').split('/').filter(Boolean);
    return parts.includes('edit');
  });
  const editRkey = $derived.by(() => {
    if (!isEditRoute) return '';
    const parts = $page.url.pathname.split('/');
    const editIndex = parts.indexOf('edit');
    return editIndex > 0 ? parts[editIndex - 1] : '';
  });

  let did = $state('');
  let status = $state('');
  let loading = $state(false);
  const t = (key, vars = {}) => translate($locale, key, vars);

  // Use reactive query to get profile from cache
  const profilesQuery = useLiveQuery(
    (q) => q.from({ profiles: profilesCollection }),
    []
  );

  // Get profile from query results, filtering by handle
  const profile = $derived.by(() => {
    if (!handle) return null;
    const profiles = profilesQuery.data || [];
    return profiles.find(p =>
      p.handle === handle ||
      p.handle === `@${handle}` ||
      p.did === did
    ) || null;
  });

  // Set context so child pages can access profile and did
  setContext('profile', {
    get profile() { return profile; },
    get did() { return did || ''; },
    get handle() { return normalizedHandle; }
  });

  function refreshProfile() {
    if (handle) {
      loadProfileData(handle);
    }
  }

  async function loadProfileData(currentHandle: string) {
    loading = true;
    status = '';
    did = '';

    try {
      // Resolve DID first
      const resolvedDid = await resolveHandle(currentHandle);
      did = resolvedDid;

      // Load profile into cache (will update reactive query automatically)
      await loadProfile(currentHandle);
    } catch (err) {
      status = (err as Error)?.message || String(err);
    } finally {
      loading = false;
    }
  }

  function closeEditDialog() {
    const userHandle = handle || $session?.handle || '';
    const fallback = userHandle ? `/@${encodeURIComponent(userHandle)}` : '/';
    goto(resolve(fallback), { replaceState: false, noScroll: true, keepFocus: true });
  }

  // Load profile when handle changes
  $effect(() => {
    if (handle) {
      // Check cache first for instant load
      const cached = getProfileFromCache(handle);
      if (cached) {
        did = cached.did;
      }
      // Always load fresh data (will update cache if changed)
      loadProfileData(handle);
    }
  });
</script>

<SeoHead
  title={profileTitle}
  description={profileDescription}
  image={profileImage}
  favicon={profileFavicon}
  type="profile"
/>

{#if !isEditRoute}
<div class="max-w-4xl mx-auto w-full">
  {#if handle}
    {#if loading}
      <div class="flex items-center justify-center min-h-[50vh]">
        <StateCard
          icon={Loader2}
          loading={true}
          title={t('profile.loadingTitle')}
          description={t('profile.loadingDescription')}
        />
      </div>
    {:else if status}
      <div class="flex items-center justify-center min-h-[50vh]">
        <StateCard
          icon={AlertCircle}
          title={t('profile.errorTitle')}
          description={status}
          class="mb-6"
        >
          {#snippet actions()}
            <Button variant="outline" onclick={refreshProfile}>
              {t('buttons.tryAgain')}
            </Button>
          {/snippet}
        </StateCard>
      </div>
    {:else}
      <div class="space-y-6">
        <div class="sticky top-2 lg:top-4 z-20 bg-background">
          <ProfileHeader {profile} {handle} size="lg" class="m-0" clickable={false}>
              {#snippet children()}
                <div class="flex gap-3 flex-wrap">
                  {#if did && $session?.did !== did}
                    <FollowButton actorDid={did} />
                  {/if}
                </div>
              {/snippet}
            </ProfileHeader>
        </div>

        <ProfileNav {handle} />

        {#if !isEditRoute}
          <div class="pt-2">
            {@render children()}
          </div>
        {/if}
      </div>
    {/if}
  {:else}
    <Card>
      <CardHeader>
        <CardTitle>{t('profile.viewFormTitle')}</CardTitle>
        <CardDescription>{t('profile.viewFormDescription')}</CardDescription>
      </CardHeader>
      <CardContent>
        <form class="space-y-4">
          <div class="space-y-2">
            <Label for="author-handle">{t('profile.formLabel')}</Label>
            <Input
              id="author-handle"
              name="handle"
              type="text"
              placeholder={t('profile.formPlaceholder')}
              required
            />
          </div>
          <Button type="submit" class="w-full">
            {t('profile.formSubmit')}
          </Button>
        </form>
      </CardContent>
    </Card>
  {/if}
</div>
{/if}

{#if isEditRoute && editRkey}
  <Dialog title={t('editTrack.title')} onClose={closeEditDialog}>
    <TrackEditDialogContent
      {handle}
      repo={did}
      rkey={editRkey}
      onsaved={closeEditDialog}
    />
  </Dialog>
{/if}
