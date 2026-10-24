<script lang="ts">
  import { Clock } from 'lucide-svelte';
  import TrackListItem from './TrackListItem.svelte';
  import DiscogsResource from './DiscogsResource.svelte';
  import { locale, translate } from '#lib/i18n/index.js';
  import { cn } from '#lib/utils/index.js';
  import type { Track } from '#lib/types/index.js';

  let { track, handle = '', items = [], index = 0, context = null, editable = false, class: className = '' } = $props<{
    track: Track;
    handle?: string;
    items?: any[];
    index?: number;
    context?: any;
    editable?: boolean;
    class?: string;
  }>();

  const t = (key, vars = {}) => translate($locale, key, vars);

  // Format timestamp
  function formatDate(dateStr: string | undefined) {
    if (!dateStr) return null;
    try {
      const date = new Date(dateStr);
      return new Intl.DateTimeFormat($locale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(date);
    } catch {
      return null;
    }
  }

  const createdDate = $derived(formatDate(track.created_at));
  const updatedDate = $derived(formatDate(track.updated_at));
  const wasEdited = $derived(track.updated_at && track.created_at && track.updated_at !== track.created_at);
</script>

<div class={cn("space-y-4", className)}>
  <!-- Track item in detail view -->
  <TrackListItem
    item={track}
    {index}
    {items}
    {context}
    {editable}
    isDetailView={true}
    flat={false}
    showAuthor={false}
  />

  <!-- Timestamps -->
  {#if createdDate || updatedDate}
    <div class="flex flex-wrap gap-3 text-xs text-muted-foreground px-2">
      {#if createdDate}
        <div class="flex items-center gap-1.5">
          <Clock class="h-3 w-3" />
          <span>{t('trackDetail.created')}: {createdDate}</span>
        </div>
      {/if}
      {#if wasEdited && updatedDate}
        <div class="flex items-center gap-1.5">
          <Clock class="h-3 w-3" />
          <span>{t('trackDetail.updated')}: {updatedDate}</span>
        </div>
      {/if}
    </div>
  {/if}

  {#if track.discogs_url || track.discogsUrl}
    <DiscogsResource url={track.discogs_url || track.discogsUrl} {handle} sourceTrackUri={track.uri} />
  {/if}
</div>
