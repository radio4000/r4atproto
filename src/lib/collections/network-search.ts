/**
 * Tracks of the whole network by #tags, @mention or words, from the index. Without
 * it there is no way short of reading every radio (views.svelte.ts does that then).
 */
import {fromIndex, indexGet} from '#lib/atproto/appview.js'
import {trackFromView, type RecordView} from '#lib/atproto/index-views.js'
import type {Track} from '#lib/types.js'
import type {ViewSource} from '#lib/views.js'
import {keepTracks} from './tracks'

/** The most the index returns per read */
const LIMIT = 100

function listTracks(params: {tags?: string[]; mention?: string; q?: string}) {
	return indexGet<{tracks: RecordView[]}>('listTracks', {...params, limit: LIMIT}).then(
		({tracks}) => tracks.flatMap((view) => trackFromView(view) ?? [])
	)
}

/** Matching tracks, newest first, kept in the tracks collection; null without the index */
export function searchNetworkTracks(source: ViewSource): Promise<Track[] | null> {
	return fromIndex(
		async () => {
			const words = {mention: source.mention, q: source.search?.trim() || undefined}
			const tags = source.tags ?? []
			// The index matches all tags; any tag is one read per tag, merged
			const reads =
				tags.length > 1 && source.tagsMode !== 'all'
					? tags.map((tag) => listTracks({...words, tags: [tag]}))
					: [listTracks({...words, tags: tags.length ? tags : undefined})]
			const byId = new Map((await Promise.all(reads)).flat().map((t) => [t.id, t]))
			const tracks = [...byId.values()].toSorted((a, b) => b.created_at.localeCompare(a.created_at))
			keepTracks(tracks)
			return tracks
		},
		async () => null
	)
}
