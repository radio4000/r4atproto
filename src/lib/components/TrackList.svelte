<script lang="ts">
  import TrackListItem from './TrackListItem.svelte';
  import StateCard from '#lib/components/ui/state-card.svelte';
  import { Music4 } from 'lucide-svelte';
  import { locale, translate } from '#lib/i18n/index.js';

  const { tracks = [], context = null, editable = false } = $props();

  function handleRemove(event) {
    const removedUri = event.detail?.uri;
    if (removedUri) {
      const idx = tracks.findIndex((t) => t.uri === removedUri);
      if (idx !== -1) tracks.splice(idx, 1);
    }
  }
  const t = (key, vars = {}) => translate($locale, key, vars);
</script>

{#if tracks && tracks.length > 0}
  <div class="rounded-xl border border-border divide-y overflow-visible">
    {#each tracks as item, idx (item.uri || idx)}
      <TrackListItem
        {item}
        index={idx}
        items={tracks}
        {context}
        {editable}
        flat={true}
        on:remove={handleRemove}
      />
    {/each}
  </div>
{:else}
  <StateCard
    icon={Music4}
    title={t('trackList.emptyTitle')}
    description={t('trackList.emptyDescription')}
  />
{/if}
