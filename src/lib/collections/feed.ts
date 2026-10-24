/**
 * The network feed: the latest tracks of every radio the relay knows, newest first.
 * One listRecords per radio, so it suits today's network size (see channels.ts).
 */
import app from '#lib/config/app.json' with {type: 'json'}
import {TRACK} from '#lib/lexicons.js'
import {resolveIdentity} from '#lib/atproto/identity.js'
import {listRecords} from '#lib/atproto/repo.js'
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
	return page.records.map((r) => trackFromRecord(r, owner))
}

/** The latest `perRadio` tracks of each radio (optionally only `dids`), merged newest first */
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
		queryFn: async () => {
			const radios = dids ?? (await fetchRadioDids())
			const results: Track[][] = []
			for (let i = 0; i < radios.length; i += CONCURRENCY) {
				const batch = radios.slice(i, i + CONCURRENCY)
				results.push(
					...(await Promise.all(batch.map((did) => latestOf(did, perRadio).catch(() => []))))
				)
			}
			return results.flat().toSorted((a, b) => b.created_at.localeCompare(a.created_at))
		}
	})
}
