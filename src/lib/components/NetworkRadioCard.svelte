<script lang="ts">
  import Avatar from '$lib/components/Avatar.svelte';
  import Link from '$lib/components/Link.svelte';
  import TrackListItem from '$lib/components/TrackListItem.svelte';
  import { Button } from '$lib/components/ui/button';
  import { PlayCircle } from 'lucide-svelte';
  import { setPlaylist } from '$lib/player/store';
  import { locale, translate } from '$lib/i18n';
  import type { NetworkRadio } from '$lib/services/r4-service';

  const { radio }: { radio: NetworkRadio } = $props();

  const t = (key: string, vars = {}) => translate($locale, key, vars);

  const handle = $derived(radio.profile?.handle ?? radio.did);
  const displayName = $derived(radio.profile?.displayName || handle);
  const profileHref = $derived(`/@${encodeURIComponent(handle)}`);
  const context = $derived({ type: 'profile' as const, key: radio.did, handle });

  function playAll() {
    if (radio.tracks.length) {
      setPlaylist(radio.tracks, 0, context);
    }
  }
</script>

<section class="space-y-2" aria-label={`Latest tracks by ${displayName}`}>
  <div class="flex items-center justify-between gap-3 px-1">
    <Link href={profileHref} class="flex items-center gap-3 min-w-0 group">
      <Avatar src={radio.profile?.avatar} alt={displayName} size="md" class="shrink-0" />
      <span class="min-w-0">
        <span class="block truncate font-semibold text-foreground group-hover:text-primary transition-colors">
          {displayName}
        </span>
        <span class="block truncate text-xs text-muted-foreground">@{handle}</span>
      </span>
    </Link>
    <Button
      variant="outline"
      size="sm"
      onclick={playAll}
      class="gap-2 shrink-0"
      title={t('network.playLatest')}
    >
      <PlayCircle class="h-4 w-4" />
      <span class="hidden sm:inline">{t('network.playLatest')}</span>
    </Button>
  </div>

  <div class="rounded-xl border border-foreground bg-card/70 overflow-hidden">
    {#each radio.tracks as item, index (item.uri)}
      <TrackListItem
        {item}
        {index}
        items={radio.tracks}
        {context}
        flat={true}
        showAuthor={false}
      />
    {/each}
  </div>
</section>
