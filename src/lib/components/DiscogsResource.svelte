<script lang="ts">
	import {onMount} from 'svelte'
	import {
		parseDiscogsUrl,
		fetchDiscogs,
		resourceTrackToR4Track
	} from '#lib/services/discogs.service.js'
	import {play} from '#lib/player/store.js'
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '#lib/components/ui/card/index.js'
	import {Button} from '#lib/components/ui/button/index.js'
	import {ExternalLink, Play, Disc} from 'lucide-svelte'
	import {locale, translate} from '#lib/i18n/index.js'
	import TrackListItem from '#lib/components/TrackListItem.svelte'

	let {url = '', handle = '', sourceTrackUri = ''} = $props()

	const t = (key, vars = {}) => translate($locale, key, vars)

	let resource = $state(null)
	let loading = $state(true)
	let error = $state('')
	let imageError = $state(false)

	function handleImageError(e) {
		console.error('[DiscogsResource] Image failed to load:', {
			src: e.target?.src,
			resource
		})
		imageError = true
	}

	async function loadResource() {
		if (!url) return

		loading = true
		error = ''
		imageError = false

		try {
			const info = parseDiscogsUrl(url)
			if (!info) {
				error = 'Invalid Discogs URL'
				return
			}

			const data = await fetchDiscogs(info)
			console.log('[DiscogsResource] Fetched data:', {
				id: data.id,
				title: data.title,
				thumb: data.thumb,
				cover_image: data.cover_image
			})
			resource = data
		} catch (e) {
			error = String(e?.message || e)
		} finally {
			loading = false
		}
	}

	onMount(() => {
		loadResource()
	})

	$effect(() => {
		if (url) {
			loadResource()
		}
	})

	function playTrack(track, index) {
		const allTracks = resource.tracklist.map((t) =>
			resourceTrackToR4Track(t, resource, sourceTrackUri)
		)
		const tracksWithMedia = allTracks.filter((t) => t.url)

		// Find the new index in the filtered list
		const clickedTrack = allTracks[index]
		const newIndex = tracksWithMedia.findIndex((t) => t.title === clickedTrack.title)

		play(tracksWithMedia, newIndex >= 0 ? newIndex : 0, {
			type: 'discogs',
			key: resource.id,
			handle: handle || resource.artists_sort || resource.artists?.map((a) => a.name).join(', ')
		})
	}

	function playAll() {
		playTrack(resource.tracklist[0], 0)
	}

	const artistName = $derived(
		resource?.artists_sort || resource?.artists?.map((a) => a.name).join(', ') || 'Unknown Artist'
	)

	const r4Tracks = $derived.by(() => {
		if (!resource?.tracklist) return []
		return resource.tracklist.map((t) => resourceTrackToR4Track(t, resource, sourceTrackUri))
		// Show all tracks, even without media URLs
	})

	// Filtered list with only tracks that have media URLs for playback
	const playableTracks = $derived.by(() => {
		return r4Tracks.filter((t) => t.url)
	})

	const context = $derived({
		type: 'discogs',
		key: resource?.id,
		handle: handle || resource?.artists_sort || resource?.artists?.map((a) => a.name).join(', ')
	})
</script>

{#if loading}
	<Card>
		<CardContent class="p-6">
			<p class="text-sm text-muted-foreground">Loading Discogs data...</p>
		</CardContent>
	</Card>
{:else if error}
	<Card>
		<CardContent class="p-6">
			<p class="text-sm text-destructive">{error}</p>
		</CardContent>
	</Card>
{:else if resource}
	<Card>
		<CardHeader>
			<div class="flex items-start gap-4">
				{#if !imageError && (resource.thumb || resource.cover_image)}
					<img
						src={resource.thumb || resource.cover_image}
						alt={resource.title}
						class="w-20 h-20 rounded object-cover shrink-0"
						onerror={handleImageError}
					/>
				{:else}
					<div class="w-20 h-20 rounded bg-muted flex items-center justify-center shrink-0">
						<Disc class="h-8 w-8 text-muted-foreground" />
					</div>
				{/if}
				<div class="flex-1 min-w-0">
					<CardTitle class="text-lg">{artistName}</CardTitle>
					<CardDescription>{resource.title}</CardDescription>
					{#if resource.year || resource.genres?.length || resource.styles?.length}
						<div class="flex gap-2 mt-2 text-xs text-muted-foreground flex-wrap">
							{#if resource.year}
								<span>{resource.year}</span>
							{/if}
							{#if resource.genres?.length || resource.styles?.length}
								<span>•</span>
								<span>{[...(resource.genres || []), ...(resource.styles || [])].join(', ')}</span>
							{/if}
						</div>
					{/if}
				</div>
			</div>
		</CardHeader>
		<CardContent class="space-y-3">
			{#if r4Tracks.length > 0}
				<div class="space-y-1">
					<p class="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2">
						Tracklist ({r4Tracks.length}
						{r4Tracks.length === 1 ? 'track' : 'tracks'})
					</p>
					<div class="rounded-lg border-0 space-y-0">
						{#each r4Tracks as track, idx (track.title + idx)}
							{@const playableIndex = playableTracks.findIndex((t) => t.title === track.title)}
							<TrackListItem
								item={track}
								index={playableIndex >= 0 ? playableIndex : 0}
								items={playableTracks}
								{context}
								editable={false}
								flat={true}
								showAuthor={false}
							/>
						{/each}
					</div>
				</div>
			{/if}
		</CardContent>
	</Card>
{/if}
