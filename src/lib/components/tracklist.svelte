<script>
	import SvelteVirtualList from '@humanspeak/svelte-virtual-list'
	import TrackCard from '#lib/components/track-card.svelte'
	import ChannelMicroCard from '#lib/components/channel-micro-card.svelte'
	import {listboxNav} from '#lib/components/listbox-nav.svelte.js'
	import {playTrack, setPlaylist} from '#lib/api.js'
	import {appState} from '#lib/app-state.svelte.js'
	import {tracksCollection} from '#lib/collections/tracks.js'
	import {SvelteMap} from 'svelte/reactivity'
	import {untrack} from 'svelte'
	import {getLocale} from '#lib/paraglide/runtime.js'
	import * as m from '#lib/paraglide/messages.js'

	/** @typedef {import('#lib/types.js').Track} Track */
	/** @typedef {{track: Track, index: number}} IndexedTrack */

	/** @typedef {{type: 'year' | 'month' | 'track', value?: string, track?: Track, index?: number, id: string}} FlatItem */

	/** @type {{
		tracks: Track[],
		playlistTracks?: Track[],  // playlist context when rendering a subset (e.g. preview)
		deckId?: number,
		playlistTitle?: string,
		footer?: (props: {track: Track}) => any,
		grouped?: boolean,
		canEdit?: boolean,
		canEditTrack?: (track: Track) => boolean,
		virtual?: boolean,
		playContext?: boolean,
		showSlug?: boolean,
		selectedTrackId?: string | null,
		onSelectTrack?: (trackId: string | null) => void,
		onTagClick?: (tag: string) => void,
		onMentionClick?: (slug: string) => void,
		selectedTags?: string[]
		}}
	*/
	const {
		tracks,
		playlistTracks,
		deckId,
		playlistTitle,
		footer,
		grouped = false,
		canEdit = false,
		canEditTrack,
		virtual = false,
		playContext = false,
		showSlug = false,
		selectedTrackId: selectedTrackIdProp = null,
		onSelectTrack,
		onTagClick,
		onMentionClick,
		selectedTags
	} = $props()
	let internalSelectedTrackId = $state(/** @type {string | null} */ (null))
	const selectedTrackId = $derived(selectedTrackIdProp ?? internalSelectedTrackId)
	const contextTracks = $derived(playlistTracks ?? tracks)
	const contextTrackIds = $derived(contextTracks.map((track) => track.id))
	const contextPlaylistTitle = $derived(playlistTitle?.trim() || undefined)
	const canEditItem = (track) => canEditTrack?.(track) ?? canEdit

	const selectTrackFromEvent = (event, trackId) => {
		const target = /** @type {HTMLElement} */ (event.target)
		if (target.closest('button, a, input, [role="button"]')) return
		if (onSelectTrack) {
			onSelectTrack(trackId)
		} else {
			internalSelectedTrackId = trackId
		}
	}

	// Build the trackId → deck info map once here instead of iterating appState.decks
	// inside every TrackCard. Rebuilds only when deck state changes (play/pause, track
	// advance), not per row. Mirrors the per-card semantics in track-card.svelte:
	// with deckId set, only that deck counts; otherwise the first deck holding a track wins.
	/** @typedef {{deckId: number, isPlaying: boolean}} DeckInfo */
	const deckMap = $derived.by(() => {
		/** @type {Map<string, DeckInfo>} */
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		const map = new Map()
		if (deckId != null) {
			const deck = appState.decks[deckId]
			if (deck?.playlist_track)
				map.set(deck.playlist_track, {deckId, isPlaying: Boolean(deck.is_playing)})
			return map
		}
		for (const [id, deck] of Object.entries(appState.decks)) {
			const pt = deck?.playlist_track
			if (pt && !map.has(pt)) map.set(pt, {deckId: Number(id), isPlaying: Boolean(deck.is_playing)})
		}
		return map
	})

	// Cards read deckInfos.get(track.id), which tracks only that key, so a play or pause
	// re-runs the cards whose entry changed instead of every row (~2.6k on a big channel).
	// Every row gets a key up front: get() on a missing key, and any set(), bump one
	// map-wide version signal that would otherwise re-run every keyless row.
	// Pre-effect, so keys exist before the cards render.
	/** @type {SvelteMap<string, DeckInfo | undefined>} */
	const deckInfos = new SvelteMap()
	/** @type {Map<string, DeckInfo>} */
	let shownDeckMap = new Map()
	$effect.pre(() => {
		const next = deckMap
		const rows = tracks
		untrack(() => {
			for (const track of rows)
				if (!deckInfos.has(track.id)) deckInfos.set(track.id, next.get(track.id))
			for (const id of shownDeckMap.keys()) if (!next.has(id)) deckInfos.set(id, undefined)
			// deckMap rebuilds its entries, so compare fields: set() notifies on any new object.
			for (const [id, info] of next) {
				const prev = deckInfos.get(id)
				if (prev?.deckId !== info.deckId || prev?.isPlaying !== info.isPlaying)
					deckInfos.set(id, info)
			}
		})
		shownDeckMap = next
	})

	const playFromList = (trackId) => {
		const targetDeck = deckId ?? appState.active_deck_id
		// Lists can show rows from anywhere (feeds, search): make sure the ones we play are loaded
		const missing = contextTracks.filter((t) => !tracksCollection.has(t.id))
		if (missing.length) {
			if (!tracksCollection.isReady()) tracksCollection.startSyncImmediate()
			tracksCollection.utils.writeUpsert(missing)
		}
		if (playContext && contextTrackIds.length) {
			setPlaylist(targetDeck, contextTrackIds, {title: contextPlaylistTitle})
		}
		playTrack(targetDeck, trackId, null, 'user_click_track')
	}

	/** Localized month names (0-11) for the locale. @param {string} locale */
	function getLocalizedMonths(locale) {
		const formatter = new Intl.DateTimeFormat(locale, {month: 'long'})
		return Array.from({length: 12}, (_, i) => formatter.format(new Date(2024, i, 1)))
	}

	const months = $derived(getLocalizedMonths(getLocale()))

	/** @type {any} */
	let virtualList = $state()

	/** @param {number} index */
	export function scrollToItem(index) {
		virtualList?.scroll({index, smoothScroll: true, shouldThrowOnBounds: false})
	}

	// Rebuild only when render mode or the track set changes, compared by element
	// identity: an in-place edit swaps a track object (useLiveQuery yields a fresh row)
	// so we rebuild, but benign churn (re-deriving on deck ticks) reuses the same refs
	// and keeps the cache.
	let modeKey = $derived(`${grouped}-${virtual}`)

	/**
	 * @param {Track[]} a
	 * @param {Track[]} b
	 */
	function sameTrackRefs(a, b) {
		if (a.length !== b.length) return false
		for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
		return true
	}

	/** @type {{mode: string, source: Track[], items: FlatItem[], groups: SvelteMap<string, SvelteMap<string, IndexedTrack[]>>}} */
	let cache = {mode: '', source: [], items: [], groups: new SvelteMap()}

	function cacheValid() {
		return cache.mode === modeKey && sameTrackRefs(cache.source, tracks)
	}

	/** @type {SvelteMap<string, SvelteMap<string, IndexedTrack[]>>} */
	let groupedTracks = $derived.by(() => {
		if (!grouped || !tracks.length) return new SvelteMap()
		if (cacheValid()) return cache.groups

		// Build groups with plain Map first (faster), convert to SvelteMap at end
		/** @type {Map<string, Map<string, IndexedTrack[]>>} */
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		const groups = new Map()
		let index = 0
		for (const track of tracks) {
			// Extract year/month from ISO string (fast, avoids Date object creation)
			const year = track.created_at.slice(0, 4)
			const monthIndex = parseInt(track.created_at.slice(5, 7), 10) - 1
			const month = months[monthIndex]

			let yearGroup = groups.get(year)
			if (!yearGroup) {
				// eslint-disable-next-line svelte/prefer-svelte-reactivity
				yearGroup = new Map()
				groups.set(year, yearGroup)
			}

			let monthTracks = yearGroup.get(month)
			if (!monthTracks) {
				monthTracks = []
				yearGroup.set(month, monthTracks)
			}
			monthTracks.push({track, index: index++})
		}

		// Convert to SvelteMap for reactivity in template
		const svelteGroups = new SvelteMap(
			Array.from(groups, ([year, months]) => [year, new SvelteMap(months)])
		)
		cache.groups = svelteGroups
		return svelteGroups
	})

	/** @type {FlatItem[]} */
	let flatItems = $derived.by(() => {
		if (!tracks.length) return []
		if (cacheValid() && cache.items.length) return cache.items

		if (!grouped) {
			const items = tracks.map((track, index) => ({
				type: /** @type {const} */ ('track'),
				track,
				index,
				id: track.id
			}))
			cache = {mode: modeKey, source: tracks, items, groups: cache.groups}
			return items
		}

		/** @type {FlatItem[]} */
		const items = []
		for (const [year, monthsMap] of groupedTracks) {
			for (const [month, monthTracks] of monthsMap) {
				items.push({type: 'month', value: `${month} ${year}`, id: `month-${year}-${month}`})
				for (const {track, index} of monthTracks) {
					items.push({type: 'track', track, index, id: track.id})
				}
			}
		}
		cache = {mode: modeKey, source: tracks, items, groups: cache.groups}
		return items
	})
</script>

{#snippet trackItem(track, index)}
	<TrackCard
		{track}
		{index}
		{deckId}
		deckLookup={deckInfos}
		selected={selectedTrackId === track.id}
		onPlay={playContext ? playFromList : undefined}
		canEdit={canEditItem(track)}
		showSlug={false}
		{onTagClick}
		{onMentionClick}
		{selectedTags}
	/>
	{#if showSlug}<ChannelMicroCard slug={track.slug} />{/if}
	{@render footer?.({track})}
{/snippet}

{#snippet trackRow(track, index)}
	<li
		role="option"
		aria-selected="false"
		id="track-{track.id}"
		data-track-id={track.id}
		onclick={(event) => selectTrackFromEvent(event, track.id)}
	>
		{@render trackItem(track, index)}
	</li>
{/snippet}

{#if tracks.length}
	<r4-tracklist mode={virtual ? 'virtual' : grouped ? 'grouped' : 'list'} show-slug={showSlug}>
		{#if virtual}
			<SvelteVirtualList
				bind:this={virtualList}
				items={flatItems}
				defaultEstimatedItemHeight={72}
				bufferSize={20}
			>
				{#snippet renderItem(item)}
					{#if item.type === 'month'}
						<h3>{item.value}</h3>
					{:else if item.track}
						<r4-tracklist-row
							role="option"
							tabindex="-1"
							aria-selected={selectedTrackId === item.track?.id}
							aria-current={deckId != null &&
								appState.decks[deckId]?.playlist_track === item.track?.id}
							id="track-{item.track.id}"
							data-track-id={item.track.id}
							onclick={(event) => selectTrackFromEvent(event, item.track?.id)}
						>
							{@render trackItem(item.track, item.index)}
						</r4-tracklist-row>
					{/if}
				{/snippet}
			</SvelteVirtualList>
		{:else}
			<div
				role="listbox"
				tabindex="0"
				aria-label={m.nav_tracks()}
				{@attach listboxNav({
					onSelect: (_, el) => el.dataset.trackId && playFromList(el.dataset.trackId),
					onChange: (_, el) => {
						const nextId = el.dataset.trackId ?? null
						if (onSelectTrack) onSelectTrack(nextId)
						else internalSelectedTrackId = nextId
					},
					wrap: true,
					selectOnClick: false
				})}
			>
				{#if grouped}
					{#each groupedTracks as [year, months] (year)}
						{#each months as [month, monthTracks] (month)}
							<section style:contain-intrinsic-size="auto {monthTracks.length * 66 + 40}px">
								<h3>{month} {year}</h3>
								<ul>
									{#each monthTracks as item (item.track.id)}
										{@render trackRow(item.track, item.index)}
									{/each}
								</ul>
							</section>
						{/each}
					{/each}
				{:else}
					<ul>
						{#each tracks as track, index (track.id)}
							{@render trackRow(track, index)}
						{/each}
					</ul>
				{/if}
			</div>
		{/if}
	</r4-tracklist>
{/if}

<style>
	r4-tracklist {
		display: flex;
		flex-direction: column;
		min-height: 0;
		container-type: inline-size;
	}

	/* Narrow lists: a radio is just its avatar next to each track */
	@container (max-width: 520px) {
		r4-tracklist[show-slug='true'] :global(r4-channel-micro-card span) {
			display: none;
		}
	}

	ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	/* Track rows carry their own border; a small gap keeps neighbours from merging */
	li,
	r4-tracklist-row {
		display: block;
		margin-bottom: 2px;
	}

	/* Skip render/layout work for off-screen rows in the non-virtual lists. The
	   fallback size matches a real row; scrollIntoView and keyboard nav still reveal them. */
	section {
		content-visibility: auto;
	}

	li {
		content-visibility: auto;
		contain-intrinsic-size: auto 58px;
	}

	r4-tracklist[show-slug='true'] :is(li, r4-tracklist-row) {
		display: flex;
		align-items: center;
		gap: var(--space-1);

		> :global(r4-track-card) {
			flex: 1;
			min-width: 0;
		}
	}

	h3 {
		text-align: center;
		text-transform: uppercase;
		font-size: var(--font-2);
		font-weight: 400;
		font-family: var(--font-mono);
		letter-spacing: 0.03em;
		margin-block: var(--space-2);
	}

	r4-tracklist[mode='virtual'] {
		flex: 1;
		overflow: hidden;

		:global(.virtual-list-container) {
			flex: 1;
			min-height: 0;
		}

		:global(.virtual-list-viewport) {
			height: 100%;
			overflow-y: auto;
			overflow-x: hidden;
		}
	}

	r4-tracklist-row[aria-current='true'] {
		position: sticky;
		top: 0;
		bottom: 0;
		z-index: 1;
	}
</style>
