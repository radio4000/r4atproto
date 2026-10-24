import {extractMentions, fuzzySearch, shuffleArray} from '#lib/utils.js'
import {useLiveQuery} from '#lib/useLiveQuery.svelte.js'
import {inArray} from '@tanstack/db'
import {tracksCollection} from '#lib/collections/tracks.js'
import {channelsCollection, fetchRadioDids} from '#lib/collections/channels.js'
import type {Channel, Deck, Track} from '#lib/types.js'
import {viewURI, type View, type ViewSource} from '#lib/views.js'

const EMPTY_STRINGS: string[] = []

/**
 * Which fetch+filter path queryView should use for a View.
 * - `channel`: the channel's tracks, newest first
 * - `channel-filtered`: the channel's tracks, post-filtered by tags/mention/search
 * - `tags-only`, `search-only`: every radio's tracks, post-filtered. No index exists
 *   without a server, so these load all radios — fine at today's network size.
 * - `empty`: no source specified, returns nothing
 */
export type ViewStrategy = 'channel' | 'channel-filtered' | 'tags-only' | 'search-only' | 'empty'

type ProcessViewTracksOptions = {
	shuffleRand?: () => number
	/** Set when the caller already passes input sorted by created_at desc, so the default sort can be skipped. */
	inputOrder?: 'created-desc'
}

/** Decide which fetch strategy to use based on the first source of a View. */
export function resolveViewStrategy(source?: ViewSource): ViewStrategy {
	const hasChannels = !!source?.channels?.length
	const hasTags = !!source?.tags?.length
	const hasSearch = !!source?.search?.trim()
	if (hasChannels && (hasTags || hasSearch || source?.mention)) return 'channel-filtered'
	if (hasChannels) return 'channel'
	if (hasTags) return 'tags-only'
	if (hasSearch) return 'search-only'
	return 'empty'
}

/** Auto-radio decks matching a specific View identity. */
export function getAutoDecksForView(decks: Deck[], view?: View): Deck[] {
	const key = viewURI(view)
	return decks.filter((d) => d.auto_radio && viewURI(d.view) === key)
}

/**
 * Post-process raw tracks: tags, exact description mention, fuzzy search, sort/shuffle.
 * This is the "refine locally" stage — input comes from a broad fetch (FTS, overlaps, or channel dump).
 */
export function processViewTracks(
	tracks: Track[],
	view: View,
	options: ProcessViewTracksOptions = {}
): Track[] {
	let data = tracks
	const q = view.sources[0]
	if (q?.tags?.length) {
		if (q.tagsMode === 'all') {
			data = data.filter((t) => q.tags?.every((tag) => t.tags?.includes(tag)))
		} else {
			data = data.filter((t) => t.tags?.some((tag) => q.tags?.includes(tag)))
		}
	}
	if (q?.mention) {
		const mention = `@${q.mention.toLowerCase()}`
		data = data.filter((t) => extractMentions(t.description ?? '').includes(mention))
	}
	if (q?.search) {
		data = fuzzySearch(q.search, data, ['title', 'description'])
	}
	// Default order is created_at desc; skip the re-sort when the caller says input already is.
	const isDefaultSort = !view.order && (!view.direction || view.direction === 'desc')
	const skipSort = isDefaultSort && !q?.search && options.inputOrder === 'created-desc'
	if (view.order === 'shuffle') {
		data = shuffleArray(data, options.shuffleRand ?? Math.random)
	} else if (!skipSort) {
		const sortField =
			view.order === 'name' ? 'title' : view.order === 'updated' ? 'updated_at' : 'created_at'
		const dir = view.direction === 'asc' ? 1 : -1
		data = data.toSorted((a, b) => {
			const va = a[sortField] ?? ''
			const vb = b[sortField] ?? ''
			return va < vb ? -dir : va > vb ? dir : 0
		})
	}
	return data
}

/** Reactive view query. Call during component init. Returns {tracks, channels, loading, strategy} with getters. */
export function queryView(getView: () => View) {
	const channelSlugs = $derived(getView().sources[0]?.channels ?? EMPTY_STRINGS)
	const channelSlugsKey = $derived(channelSlugs.join(','))
	const limit = $derived(getView().limit ?? 50)
	const offset = $derived(getView().offset ?? 0)
	const strategy = $derived(resolveViewStrategy(getView().sources[0]))
	const global = $derived(strategy === 'tags-only' || strategy === 'search-only')

	// Global strategies read every radio the relay knows
	let radioDids = $state.raw<string[] | undefined>(undefined)
	$effect(() => {
		if (global && !radioDids) fetchRadioDids().then((dids) => (radioDids = dids))
	})
	const radioDidsKey = $derived(radioDids?.join(',') ?? '')

	const channelsQuery = useLiveQuery(
		(q) => {
			if (!channelSlugs.length)
				return q.from({c: channelsCollection}).where(({c}) => inArray(c.id, ['']))
			return q.from({c: channelsCollection}).where(({c}) => inArray(c.slug, channelSlugs))
		},
		[() => channelSlugsKey]
	)

	const tracksQuery = useLiveQuery(
		(q) => {
			if (global) {
				if (!radioDids?.length)
					return q.from({tracks: tracksCollection}).where(({tracks}) => inArray(tracks.id, ['']))
				return q
					.from({tracks: tracksCollection})
					.where(({tracks}) => inArray(tracks.did, radioDids))
					.orderBy(({tracks}) => tracks.created_at, 'desc')
			}
			if (strategy !== 'channel' && strategy !== 'channel-filtered')
				return q.from({tracks: tracksCollection}).where(({tracks}) => inArray(tracks.id, ['']))
			return q
				.from({tracks: tracksCollection})
				.where(({tracks}) => inArray(tracks.slug, channelSlugs))
				.orderBy(({tracks}) => tracks.created_at, 'desc')
		},
		[() => strategy, () => channelSlugsKey, () => radioDidsKey]
	)

	const processed = $derived(
		processViewTracks((tracksQuery.data ?? []) as Track[], getView(), {inputOrder: 'created-desc'})
	)

	return {
		get strategy() {
			return strategy
		},
		get tracks() {
			return processed.slice(offset, offset + limit)
		},
		get count(): number {
			return processed.length
		},
		get channels() {
			return (channelsQuery.data ?? []) as Channel[]
		},
		get loading() {
			if (strategy === 'empty') return false
			if (global && !radioDids) return true
			return !tracksQuery.isReady
		}
	}
}
