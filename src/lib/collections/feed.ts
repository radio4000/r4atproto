/**
 * The network feed: the latest tracks of the network, or of some radios, newest first.
 * From the index; without it, one listRecords per radio the relay knows (see channels.ts).
 */
import app from '#lib/config/app.json' with {type: 'json'}
import {TRACK} from '#lib/lexicons.js'
import {resolveIdentity} from '#lib/atproto/identity.js'
import {listRecords} from '#lib/atproto/repo.js'
import {fromIndex, indexGet} from '#lib/atproto/appview.js'
import {trackFromView, type RecordView} from '#lib/atproto/index-views.js'
import {trackFromRecord, type TrackRecord} from '#lib/atproto/records.js'
import type {Track} from '#lib/types.js'
import {fetchRadioDids} from './channels'
import {queryClient} from './query-client'

const CONCURRENCY = 6

async function latestOf(did: string, limit: number): Promise<Track[]> {
	const [owner, page] = await Promise.all([
		resolveIdentity(did),
		listRecords<TrackRecord>(did, TRACK, {limit})
	])
	return page.records.flatMap((r) => trackFromRecord(r, owner) ?? [])
}

/** The latest tracks of the network, or of `dids` (without the index: `perRadio` of each, merged) */
export function fetchLatestTracks({
	perRadio = app.feed.perRadio,
	dids
}: {
	perRadio?: number
	dids?: string[]
} = {}) {
	return queryClient.query({
		queryKey: ['feed', perRadio, ...(dids?.toSorted() ?? ['all'])],
		staleTime: 2 * 60 * 1000,
		queryFn: () =>
			fromIndex(
				async () => {
					// The index answers for up to 100 radios at once
					const {tracks} = await indexGet<{tracks: RecordView[]}>('listTracks', {
						radios: dids?.slice(0, 100),
						limit: app.feed.size
					})
					return tracks.flatMap((view) => trackFromView(view) ?? [])
				},
				() => latestFromRepos(perRadio, dids)
			)
	})
}

async function latestFromRepos(perRadio: number, dids?: string[]): Promise<Track[]> {
	const radios = dids ?? (await fetchRadioDids())
	const results: Track[][] = []
	for (let i = 0; i < radios.length; i += CONCURRENCY) {
		const batch = radios.slice(i, i + CONCURRENCY)
		results.push(...(await Promise.all(batch.map((did) => latestOf(did, perRadio).catch(() => [])))))
	}
	return results.flat().toSorted((a, b) => b.created_at.localeCompare(a.created_at))
}
