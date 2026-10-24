/**
 * radio.4000.track records as an on-demand TanStack DB collection, keyed by at:// URI.
 * Same API as r4-svelte's tracks collection; rows come straight from each radio's PDS.
 * A PDS can't filter, so a channel is fetched whole and live queries filter locally.
 */
import {createCollection} from '@tanstack/svelte-db'
import {queryCollectionOptions, parseLoadSubsetOptions} from '@tanstack/query-db-collection'
import {TID} from '@atproto/common-web'
import {untrack} from 'svelte'
import {createSubscriber} from 'svelte/reactivity'
import {parseUrl} from 'media-now'
import {TRACK} from '#lib/lexicons.js'
import {resolveIdentity} from '#lib/atproto/identity.js'
import {getRecord, listAllRecords, parseAtUri} from '#lib/atproto/repo.js'
import {bareTags, trackFromRecord, trackToRecord, type TrackRecord} from '#lib/atproto/records.js'
import {createRecord, deleteRecord, myDid, putRecord} from '#lib/atproto/write.js'
import {extractMentions} from '#lib/utils.js'
import type {ChannelRef, Track} from '#lib/types.js'
import {queryClient} from './query-client'

type TrackQueryParams = {slugs: string[]; ids?: string[]}

type Filter = {field: (string | number)[]; operator: string; value: unknown}

function values(filters: Filter[], field: string): string[] {
	const found = filters.filter((f) => f.field[0] === field)
	return found.flatMap((f) =>
		f.operator === 'in' ? (f.value as string[]) : f.operator === 'eq' ? [f.value as string] : []
	)
}

function parseTrackParams(opts: Parameters<typeof parseLoadSubsetOptions>[0]): TrackQueryParams {
	const {filters} = parseLoadSubsetOptions(opts) as {filters: Filter[]}
	const ids = values(filters, 'id')
	// A channel can be asked for by handle (slug) or DID; both load the same records
	return {
		slugs: [...values(filters, 'slug'), ...values(filters, 'did')],
		ids: ids.length ? ids : undefined
	}
}

function getTrackQueryKey({slugs, ids}: TrackQueryParams): string[] {
	if (ids) return ['tracks', 'ids', ...ids.toSorted()]
	if (slugs.length) return ['tracks', ...slugs.toSorted()]
	return ['tracks']
}

/** Every track of a channel, newest first */
export async function fetchTracksBySlug(handleOrDid: string): Promise<Track[]> {
	const owner = await resolveIdentity(handleOrDid)
	const records = await listAllRecords<TrackRecord>(owner.did, TRACK)
	return records.flatMap((r) => trackFromRecord(r, owner) ?? [])
}

async function fetchTracksByIds(ids: string[]): Promise<Track[]> {
	const rows = await Promise.all(
		ids.map(async (id) => {
			const {did, rkey} = parseAtUri(id)
			const [owner, record] = await Promise.all([
				resolveIdentity(did),
				getRecord<TrackRecord>(did, TRACK, rkey)
			])
			return record ? trackFromRecord(record, owner) : null
		})
	)
	return rows.filter((t): t is Track => Boolean(t))
}

/** One track by its URI, from the collection or else its repo (then kept in the collection) */
export async function fetchTrack(id: string): Promise<Track | undefined> {
	const loaded = tracksCollection.get(id)
	if (loaded) return loaded
	const [track] = await fetchTracksByIds([id]).catch(() => [])
	if (track) {
		if (!tracksCollection.isReady()) tracksCollection.startSyncImmediate()
		tracksCollection.utils.writeUpsert(track)
	}
	return track
}

export const tracksCollection = createCollection<Track, string>({
	...queryCollectionOptions({
		queryKey: (opts) => getTrackQueryKey(parseTrackParams(opts)),
		syncMode: 'on-demand',
		startSync: true,
		queryClient,
		getKey: (item) => item.id,
		staleTime: 5 * 60 * 1000,
		queryFn: async (ctx): Promise<Track[]> => {
			const params = parseTrackParams(ctx.meta?.loadSubsetOptions)
			// Id pins (e.g. a deck's queue): reuse loaded rows, fetch only the missing ones
			if (params.ids) {
				const state = tracksCollection.state
				const present = params.ids.flatMap((id) => {
					const track = state.get(id)
					return track ? [track] : []
				})
				const missing = params.ids.filter((id) => !state.has(id))
				return missing.length ? [...present, ...(await fetchTracksByIds(missing))] : present
			}
			if (params.slugs.length) {
				const results = await Promise.all(params.slugs.map(fetchTracksBySlug))
				return results.flat()
			}
			return []
		}
	}),
	onInsert: async ({transaction}) => {
		for (const m of transaction.mutations) {
			const {rkey} = parseAtUri(m.modified.id)
			const {cid} = await createRecord(TRACK, trackToRecord(m.modified), rkey)
			tracksCollection.utils.writeUpsert({...m.modified, cid})
		}
	},
	onUpdate: async ({transaction}) => {
		for (const m of transaction.mutations) {
			const {rkey} = parseAtUri(m.modified.id)
			const {cid} = await putRecord(TRACK, rkey, trackToRecord(m.modified))
			tracksCollection.utils.writeUpsert({...m.modified, cid})
		}
	},
	onDelete: async ({transaction}) => {
		for (const m of transaction.mutations) {
			const {rkey} = parseAtUri(m.original.id)
			await deleteRecord(TRACK, rkey)
			tracksCollection.utils.writeDelete(m.original.id)
		}
	}
})

/**
 * Read inside a $derived or $effect to re-run it on any track change, then read rows
 * via `tracksCollection.get(id)`. One subscription shared by every reader.
 */
export const watchTracks = createSubscriber((update) => {
	const subscription = tracksCollection.subscribeChanges(() => untrack(update))
	return () => subscription.unsubscribe()
})

/** Fields derived from url and description */
function derived(input: {url?: string; description?: string | null}) {
	const out: Partial<Track> = {}
	if (input.url !== undefined) {
		const parsed = parseUrl(input.url)
		out.provider = parsed?.provider ?? null
		out.media_id = parsed?.id ?? null
	}
	if (input.description !== undefined) {
		out.tags = input.description ? bareTags(input.description) : []
		out.mentions = input.description ? extractMentions(input.description) : []
	}
	return out
}

/** Add a track to the signed-in account's channel; resolves with its id once persisted. */
export function addTrack(
	channel: ChannelRef,
	input: {
		url: string
		title: string
		description?: string
		discogs_url?: string
		created_at?: string
	}
) {
	const did = myDid()
	if (!did || did !== channel.id) throw new Error('You can only add tracks to your own radio')
	const now = new Date().toISOString()
	const id = `at://${did}/${TRACK}/${TID.nextStr()}`
	return tracksCollection
		.insert({
			id,
			did,
			slug: channel.slug,
			url: input.url,
			title: input.title,
			description: input.description || null,
			discogs_url: input.discogs_url || null,
			duration: null,
			playback_error: null,
			tags: [],
			mentions: [],
			created_at: input.created_at ?? now,
			updated_at: null,
			...derived(input)
		})
		.when('settled')
		.then(() => id)
}

/** Update a track's fields, re-deriving provider/media_id/tags when url or description change. */
export function updateTrack(_channel: ChannelRef, id: string, changes: Partial<Track>) {
	return tracksCollection
		.update(id, (draft) => {
			Object.assign(draft, changes, derived(changes), {updated_at: new Date().toISOString()})
		})
		.when('settled')
		.then(() => {})
}

/**
 * Save a duration learned while playing one of your own tracks, when it has none.
 * Auto radio needs durations; this fills them in as tracks get played.
 */
export function rememberTrackDuration(id: string, seconds: number) {
	// Called from player effects: reading the track must not subscribe them to it
	untrack(() => {
		const track = tracksCollection.get(id)
		if (!track || track.duration || !seconds || track.did !== myDid()) return
		updateTrack({id: track.did, slug: track.slug}, id, {duration: Math.round(seconds)}).catch(
			() => {}
		)
	})
}

export function deleteTrack(_channel: ChannelRef, id: string) {
	return tracksCollection
		.delete(id)
		.when('settled')
		.then(() => {})
}

export function batchDeleteTracks(_channel: ChannelRef, ids: string[]) {
	return tracksCollection
		.delete(ids)
		.when('settled')
		.then(() => {})
}

/** Load a channel's tracks into the collection, unless some are loaded already. */
export async function ensureTracksLoaded(slug: string): Promise<void> {
	const existing = [...tracksCollection.state.values()].some(
		(t) => t.slug === slug || t.did === slug
	)
	if (existing) return
	const data = await queryClient.query<Track[]>({
		queryKey: ['tracks', slug],
		queryFn: () => fetchTracksBySlug(slug)
	})
	if (!tracksCollection.isReady()) tracksCollection.startSyncImmediate()
	tracksCollection.utils.writeUpsert(data)
}
