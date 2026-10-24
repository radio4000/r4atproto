<script>
	import {fuzzySearch, extractMentions} from '#lib/utils.js'
	import {appState, canEditChannel} from '#lib/app-state.svelte.js'
	import {tooltip} from '#lib/components/tooltip-attachment.svelte.js'
	import {channelsCollection} from '#lib/collections/channels.js'
	import {tracksCollection, watchTracks} from '#lib/collections/tracks.js'
	import {clearQueue, clearAllQueue} from '#lib/api.js'
	import SearchInput from './search-input.svelte'
	import FilterChips from './filter-chips.svelte'
	import Icon from './icon.svelte'
	import Tracklist from './tracklist.svelte'
	import {tick, untrack} from 'svelte'
	import * as m from '#lib/paraglide/messages.js'

	/** @type {{deckId: number, scrollToActive?: (() => void) | undefined}} */
	// Write-only bindable: the parent calls it, so the destructure itself is never read here.
	// eslint-disable-next-line no-useless-assignment
	let {deckId, scrollToActive = $bindable()} = $props()

	let deck = $derived(appState.decks[deckId])

	// The filter lives on the deck: it survives closing the panel and decides what plays.
	/** @type {NonNullable<import('#lib/types.js').Deck['queue_filter']>} */
	const noFilter = {search: '', tags: [], mention: ''}
	let filter = $derived(deck?.queue_filter ?? noFilter)
	let isFiltering = $derived(Boolean(deck?.queue_filter))

	/** @param {Partial<typeof noFilter>} patch */
	function setFilter(patch) {
		if (!deck) return
		const next = {...filter, ...patch}
		deck.queue_filter = next.search || next.tags.length || next.mention ? next : undefined
		if (!deck.queue_filter) deck.playlist_tracks_filtered = undefined
	}

	function clearFilters() {
		setFilter(noFilter)
	}

	/** @param {string} tag */
	function toggleTag(tag) {
		setFilter({
			tags: filter.tags.includes(tag) ? filter.tags.filter((t) => t !== tag) : [...filter.tags, tag]
		})
	}

	/** @param {string} slug bare, lowercase, like ?mention= on /tracks */
	function toggleMention(slug) {
		setFilter({mention: filter.mention === slug ? '' : slug})
	}
	let selectedTrackId = $state(/** @type {string | null} */ (null))
	/** @type {any} */
	let tracklist = $state()

	async function doScrollToActive() {
		if (!deck?.playlist_track) return

		// If the active track is filtered out, clear the filters so it appears
		if (isFiltering && !filteredQueueTracks.some((t) => t.id === deck?.playlist_track)) {
			clearFilters()
			await tick()
		}

		const idx = filteredQueueTracks.findIndex((t) => t.id === deck?.playlist_track)
		if (idx >= 0) tracklist?.scrollToItem(idx)
	}

	$effect(() => {
		scrollToActive = doScrollToActive
	})

	// The full queue, not getActiveQueue(), which this filter already narrows.
	let trackIds = $derived(
		(deck?.shuffle ? deck.playlist_tracks_shuffled : deck?.playlist_tracks) ?? []
	)

	// Resolve tracks by id in playlist order. An inArray() live query would rebuild a
	// d2ts pipeline (~1.2s block) over a large playlist; these Map lookups are O(1).
	// watchTracks() re-runs this on any track change, so edits and late-loading rows
	// appear. See docs/tanstack.md.
	let queueTracks = $derived.by(() => {
		watchTracks()
		const state = tracksCollection.state
		return trackIds.map((id) => state.get(id)).filter((t) => !!t)
	})

	let filteredQueueTracks = $derived(
		isFiltering
			? fuzzySearch(filter.search, queueTracks, ['title', 'tags', 'description']).filter(
					(t) =>
						filter.tags.every((tag) => t.tags?.includes(tag)) &&
						(!filter.mention || extractMentions(t.description ?? '').includes(`@${filter.mention}`))
				)
			: queueTracks
	)

	// What the list shows is what plays: next/prev stay within the matches.
	// No matches leaves playback alone rather than stopping after this track.
	$effect(() => {
		if (!deck?.queue_filter) return
		const ids = filteredQueueTracks.length ? filteredQueueTracks.map((t) => t.id) : undefined
		const prev = untrack(() => deck.playlist_tracks_filtered)
		if (prev === ids || (prev?.length === ids?.length && ids?.every((id, i) => id === prev?.[i])))
			return
		deck.playlist_tracks_filtered = ids
	})

	/** @param {import('#lib/types.js').Track} track */
	function canEditTrack(track) {
		const channel = [...channelsCollection.state.values()].find((ch) => ch.slug === track.slug)
		return canEditChannel(channel?.id)
	}

	function handleClearQueue() {
		if (deck?.is_playing) {
			clearQueue(deckId)
		} else {
			clearAllQueue(deckId)
		}
	}
</script>

<r4-queue-panel>
	<r4-queue-panel-search>
		<SearchInput
			bind:value={() => filter.search, (search) => setFilter({search})}
			placeholder={`${filteredQueueTracks.length}/${queueTracks.length}`}
			debounce={150}
		/>
		{#if trackIds.length > 0 && (deck?.is_playing ? trackIds.length > 1 : true)}
			<button
				onclick={handleClearQueue}
				{@attach tooltip({content: m.common_clear()})}
				title={m.common_clear()}
			>
				<Icon icon="delete" />
			</button>
		{/if}
	</r4-queue-panel-search>

	{#if filter.tags.length || filter.mention}
		<FilterChips
			tags={filter.tags}
			mention={filter.mention}
			onRemoveTag={toggleTag}
			onClearMention={() => setFilter({mention: ''})}
		/>
	{/if}

	<r4-queue-panel-tracks>
		<!-- A compact deck is zero-width: its rows mount when it opens, not on every first play. -->
		{#if !deck?.compact}
			{#if filteredQueueTracks.length > 0}
				<Tracklist
					bind:this={tracklist}
					tracks={filteredQueueTracks}
					{deckId}
					virtual={true}
					{selectedTrackId}
					{canEditTrack}
					onSelectTrack={(trackId) => (selectedTrackId = trackId)}
					onTagClick={toggleTag}
					onMentionClick={toggleMention}
					selectedTags={filter.tags}
				/>
			{:else if queueTracks.length === 0}
				<p role="status"><small>{m.queue_no_tracks()}</small></p>
			{:else}
				<p role="status">{m.queue_empty()}</p>
				{#if filter.search}
					<p role="status"><small>{m.search_no_results()} "{filter.search}"</small></p>
				{/if}
			{/if}
		{/if}
	</r4-queue-panel-tracks>
</r4-queue-panel>

<style>
	r4-queue-panel {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 0;
		width: 100%;
		border-top: 1px solid var(--color-interface-border);
	}

	r4-queue-panel-search {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-1);
		padding: var(--space-2);
		border-bottom: 1px solid var(--color-interface-border);

		> :global(r4-search-input) {
			flex: 1 1 12rem;
		}
	}

	r4-queue-panel > :global(r4-filter-chips) {
		padding: var(--space-1) var(--space-2);
		border-bottom: 1px solid var(--color-interface-border);
	}

	r4-queue-panel-tracks {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 0;
		overflow-y: auto;
	}

	p[role='status'] {
		margin: auto;
		text-align: center;
	}

	/* The panel sits on the deck's floating background, so the playing row needs its own */
	r4-queue-panel-tracks :global(r4-track-card[active='true']) {
		background: var(--color-interface);
	}

	/* Keep titles aligned when some queue items have no artwork */
	r4-queue-panel-tracks :global(r4-track-card > article:not(:has(img))::before) {
		content: '';
		flex: 0 0 var(--track-artwork-size);
		align-self: center;
	}
</style>
