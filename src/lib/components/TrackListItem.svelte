<script lang="ts">
  import { onMount } from 'svelte';
  import { parseTrackUrl } from '$lib/services/url-patterns';
  import { deleteTrackByUri } from '$lib/services/r4-service';
  import { setPlaylist } from '$lib/player/store';
  import { session } from '$lib/state/session';
  import { buildEditHash, buildViewHash } from '$lib/services/track-uri';
  import { Button, buttonVariants } from '$lib/components/ui/button';
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
  import { Play, MoreVertical, Pencil, Trash2, ExternalLink, Disc as DiscIcon, Pause, Eye, AlertTriangle } from 'lucide-svelte';
  import { cn, menuTriggerClass } from '$lib/utils';
  import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
  import { resolve } from '$app/paths';
  import { goto } from '$app/navigation';
  import { locale, translate } from '$lib/i18n';
  import Link from '$lib/components/Link.svelte';
  import { player } from '$lib/player/store';
  import { onDestroy } from 'svelte';
  import Dialog from '$lib/components/ui/Dialog.svelte';
  import { updateTrackByUri } from '$lib/services/r4-service';

  const {
    item,
    index = 0,
    items = [],
    context = null,
    editable = false,
    expandedContent,
    isDetailView = false,
    flat = false,
    onSelectTrack,
    onEditTrack,
    onremove,
    showAuthor = true
  } = $props();
  let message = $state('');
  let showDeleteConfirm = $state(false);
  let deleting = $state(false);

  const t = (key, vars = {}) => translate($locale, key, vars);

  function play() {
    setPlaylist(items && items.length ? items : [item], items && items.length ? index : 0, context);
  }

  function confirmDelete() {
    showDeleteConfirm = true;
  }

  function cancelDelete() {
    showDeleteConfirm = false;
  }

  async function remove() {
    message = '';
    deleting = true;
    showDeleteConfirm = false;
    try {
      await deleteTrackByUri(item.uri);
      // Call the parent callback to remove from list
      if (onremove) {
        onremove({ detail: { uri: item.uri } });
      }
      // Don't reset deleting here - component should be unmounted by parent
    } catch (e) {
      message = e?.message || String(e);
      deleting = false;
      console.error('Failed to delete track:', e);
    }
  }

  function editHref() {
    // Only available for AT Protocol tracks with URI
    if (!item.uri) return null;
    const handle = $session?.handle;
    return buildEditHash(handle, item.uri);
  }

  const safeOpenUrl = $derived.by(() => {
    try {
      const m = parseTrackUrl(item?.url || '');
      return (m && m.url) || item?.url || '#';
    } catch {
      return '#';
    }
  });

  const authorHandle = $derived.by(() => {
    const raw = context?.handle || item.authorHandle || item.author_handle || null;
    return raw?.replace?.(/^@/, '') ?? raw;
  });
  const discogsLink = $derived(item?.discogs_url ?? '');
  const isActiveTrack = $derived.by(() => {
    const currentTrack = $player?.playlist?.[$player.index];
    if (!currentTrack) return false;
    // For tracks with URI (AT Protocol tracks), match by URI
    if (item?.uri && currentTrack?.uri) {
      return currentTrack.uri === item.uri;
    }
    // For tracks without URI (Discogs tracks), match by URL
    if (item?.url && currentTrack?.url) {
      return currentTrack.url === item.url;
    }
    return false;
  });

  // Check if this track has a playback error
  // Only show errors for tracks owned by the current user
  const hasMediaError = $derived.by(() => {
    if (!item?.uri) return false;
    // Only show errors to the track owner
    if (!editable || !$session?.did) return false;
    return !!item.media_error;
  });

  const hasMedia = $derived(!!item?.url);

  function clearMediaError() {
    if (!item?.uri) return;
    updateTrackByUri(item.uri, { media_error: '' }).catch((e) => {
      console.error('[TrackListItem] Failed to clear media error:', e);
    });
  }

  function viewHref() {
    // Only available for AT Protocol tracks with URI
    if (!item.uri) return null;
    return buildViewHash(authorHandle, item.uri);
  }

  function openEdit() {
    // If onEditTrack callback is provided, use it instead of navigation
    if (onEditTrack) {
      onEditTrack(item.uri);
      return;
    }

    // Otherwise, navigate to edit page (legacy behavior)
    const href = editHref();
    if (href) {
      const payload = {
        uri: item.uri,
        url: item.url,
        title: item.title,
        description: item.description,
        discogs_url: item.discogs_url || '',
      };
      goto(resolve(href), {
        state: { track: payload, returnTo: window.location.pathname },
        replaceState: false,
        noScroll: true,
        keepFocus: false,
      });
    }
  }

  function openDetail(event?: Event, opts?: { forceNavigate?: boolean }) {
    event?.preventDefault?.();

    // If onSelectTrack callback is provided, use it instead of navigation
    if (onSelectTrack && !opts?.forceNavigate) {
      onSelectTrack(item.uri);
      return;
    }

    // Otherwise, navigate to detail page (legacy behavior)
    const href = viewHref();
    if (href) {
      // Clone objects to avoid Svelte proxy serialization issues
      const navState: any = {
        returnTo: window.location.pathname,
        tracks: items ? JSON.parse(JSON.stringify(items)) : [],
        track: item ? JSON.parse(JSON.stringify(item)) : null,
        index,
        did: context?.key || item.authorDid || '',
        handle: authorHandle || (context?.handle?.replace?.(/^@/, '') ?? '')
      };
      goto(resolve(href), {
        state: navState,
        replaceState: false,
        noScroll: true,
        keepFocus: false,
      });
    }
  }

</script>

<Card
  class={cn(
    isDetailView
      ? (flat
        ? "border-0 bg-background transition-colors rounded-none shadow-none"
        : "border border-foreground bg-background transition-colors rounded-lg shadow")
      : flat
        ? "border-0 border-b border-border bg-transparent transition-colors rounded-none shadow-none ring-0 last:border-b-0"
        : "border border-foreground bg-background transition-colors hover:bg-foreground/10 rounded-lg shadow-none",
    deleting && "opacity-50 pointer-events-none"
  )}
>
  <CardHeader class={cn(
    flat ? "p-0" : "p-0",
    isDetailView && !flat && "sm:p-3",
    flat && "rounded-none"
  )}>
    <div class={cn(
      "flex items-center justify-between gap-2",
      flat && "px-2.5 py-2"
    )}>
      <div class="shrink-0 flex items-center">
        <Button
          variant="secondary"
          size="sm"
          class={cn(
            "h-7 px-2 text-xs",
            isActiveTrack && "bg-primary text-background border border-primary shadow-sm hover:bg-primary/90",
            !hasMedia && "opacity-50 cursor-not-allowed"
          )}
          disabled={isActiveTrack || !hasMedia}
          onclick={play}
          title={!hasMedia ? "No media available" : undefined}
        >
          <Play class="h-3 w-3" />
        </Button>
      </div>

      <div class={cn("flex-1 min-w-0 space-y-1", isDetailView && "sm:space-y-1.5")}>
        <div class={cn(isDetailView ? "flex flex-col gap-1.5" : "flex flex-col sm:flex-row sm:items-center sm:gap-3")}>
          {#if isDetailView && showAuthor && authorHandle}
            <CardDescription class="text-xs flex items-center gap-1">
              <span class="inline-flex items-center justify-center h-4 w-4 rounded-full bg-muted text-foreground text-[0.55rem] font-semibold">
                @
              </span>
              <Link href={`/@${encodeURIComponent(authorHandle)}`} class="hover:text-primary transition-colors">
                {authorHandle}
              </Link>
            </CardDescription>
          {/if}
          <CardTitle class="text-sm font-semibold flex items-center gap-2">
            <a
              href={viewHref() || '#'}
              onclick={openDetail}
              class={cn(
                "transition-colors cursor-pointer py-0.5 inline-block",
                isActiveTrack
                  ? "is-active rounded px-1"
                  : "hover:text-primary hover:underline"
              )}
            >
              {item.title || t('trackItem.untitled')}
            </a>
            {#if hasMediaError}
              <span
                class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-destructive/10 text-destructive border border-destructive/20"
                title={item.media_error}
              >
                <AlertTriangle class="h-3 w-3" />
                <span class="hidden sm:inline">Playback error</span>
              </span>
            {/if}
          </CardTitle>
          {#if !isDetailView && showAuthor && authorHandle}
            <CardDescription class={cn(
              "text-xs flex items-center gap-1",
              isDetailView && "mt-0 sm:mt-0"
            )}>
              <span class="inline-flex items-center justify-center h-4 w-4 rounded-full bg-muted text-foreground text-[0.55rem] font-semibold">
                @
              </span>
              <Link href={`/@${encodeURIComponent(authorHandle)}`} class="hover:text-primary transition-colors">
                {authorHandle}
              </Link>
            </CardDescription>
          {/if}
        </div>
        {#if item.description}
          <p class="text-xs text-muted-foreground whitespace-pre-wrap leading-snug !mt-0">
            {item.description}
          </p>
        {/if}
      </div>

      <div class="flex items-center gap-2 shrink-0 pl-2">
        {#if discogsLink}
          <a
            href={discogsLink?.startsWith('http') ? discogsLink : resolve(discogsLink)}
            target="_blank"
            rel="noopener"
            class={cn(menuTriggerClass(false), "h-7 w-7")}
            aria-label="Open Discogs"
          >
            <DiscIcon class="h-3 w-3" />
          </a>
        {/if}
        <a
          href={
            safeOpenUrl && safeOpenUrl !== '#'
              ? (safeOpenUrl.startsWith('http') ? safeOpenUrl : resolve(safeOpenUrl))
              : '#'
          }
          target="_blank"
          rel="noopener"
          class={cn(menuTriggerClass(false), "h-7 w-7")}
          aria-label={t('trackItem.openExternal')}
        >
          <ExternalLink class="h-3 w-3" />
        </a>

        <Button
          class="hidden"
          aria-hidden="true"
        />

        <DropdownMenu.Root>
          <DropdownMenu.Trigger
            class={cn(menuTriggerClass(false), "h-7 w-7")}
          >
            <MoreVertical class="h-3.5 w-3.5" />
            <span class="sr-only">{t('trackItem.actions')}</span>
          </DropdownMenu.Trigger>
          <DropdownMenu.Content align="end" class="w-48">
            {#if viewHref()}
              <DropdownMenu.Item onclick={(e) => { openDetail(e, { forceNavigate: true }); }}>
                <Eye class="h-4 w-4" />
                View track
              </DropdownMenu.Item>
            {/if}
            {#if editable && editHref()}
              <DropdownMenu.Item onclick={() => openEdit()}>
                <Pencil class="h-4 w-4" />
                {t('trackItem.edit')}
              </DropdownMenu.Item>
            {/if}
            <DropdownMenu.Item
              onclick={() => {
                if (safeOpenUrl && safeOpenUrl !== '#') {
                  window.open(safeOpenUrl.startsWith('http') ? safeOpenUrl : resolve(safeOpenUrl), '_blank');
                }
              }}
            >
              <ExternalLink class="h-4 w-4" />
              {t('trackItem.openMediaUrl')}
            </DropdownMenu.Item>
            {#if discogsLink}
              <DropdownMenu.Item
                onclick={() => {
                  window.open(discogsLink?.startsWith('http') ? discogsLink : resolve(discogsLink), '_blank');
                }}
              >
                <DiscIcon class="h-4 w-4" />
                Open Discogs
              </DropdownMenu.Item>
            {/if}
            {#if hasMediaError && item.uri}
              <DropdownMenu.Separator />
              <DropdownMenu.Item onclick={clearMediaError}>
                <AlertTriangle class="h-4 w-4" />
                Clear playback error
              </DropdownMenu.Item>
            {/if}
            {#if editable}
              <DropdownMenu.Separator />
              <DropdownMenu.Item onclick={confirmDelete} class="text-destructive focus:text-destructive">
                <Trash2 class="h-4 w-4" />
                {t('trackItem.delete')}
              </DropdownMenu.Item>
            {/if}
          </DropdownMenu.Content>
        </DropdownMenu.Root>
      </div>
    </div>
  </CardHeader>

  {#if message}
    <CardContent class="pt-0 pb-1.5 px-1.5">
      <div class="rounded-md bg-destructive/15 p-1.5 text-xs text-destructive">
        {message}
      </div>
    </CardContent>
  {/if}

  {#if expandedContent}
    <CardContent class="pt-0 pb-1.5 px-1.5">
      {@render expandedContent()}
    </CardContent>
  {/if}
</Card>

{#if showDeleteConfirm}
  <Dialog title="Delete track" onClose={cancelDelete}>
    <div class="space-y-4">
      <p class="text-sm text-muted-foreground">
        Are you sure you want to delete "{item.title || t('trackItem.untitled')}"? This action cannot be undone.
      </p>
      <div class="flex gap-2 justify-end">
        <Button variant="outline" onclick={cancelDelete}>
          Cancel
        </Button>
        <Button variant="destructive" onclick={remove}>
          Delete
        </Button>
      </div>
    </div>
  </Dialog>
{/if}
