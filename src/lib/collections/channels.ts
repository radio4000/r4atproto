/**
 * Radios as an on-demand TanStack DB collection, keyed by DID. A channel is an
 * account: its radio.4000.channel record when it has one, its Bluesky profile otherwise.
 *
 * Browsing (no id/slug filter) discovers radios through the relay, which indexes
 * which repos hold radio.4000.track records, then reads each repo. That fan-out
 * suits up to a few hundred radios; beyond, an indexer is needed (docs/services.md).
 */
import {createCollection} from '@tanstack/svelte-db'
import {queryCollectionOptions, parseLoadSubsetOptions} from '@tanstack/query-db-collection'
import app from '#lib/config/app.json' with {type: 'json'}
import {CHANNEL, SELF, TRACK} from '#lib/lexicons.js'
import {resolveIdentity, type Identity} from '#lib/atproto/identity.js'
import {getProfiles, type Profile} from '#lib/atproto/profiles.js'
import {getRecord, listRecords} from '#lib/atproto/repo.js'
import {xrpcGet} from '#lib/atproto/xrpc.js'
import {
	channelFrom,
	channelToRecord,
	type ChannelRecord,
	type TrackRecord
} from '#lib/atproto/records.js'
import {myDid, putRecord, uploadBlob} from '#lib/atproto/write.js'
import type {Channel} from '#lib/types.js'
import {queryClient} from './query-client'

export type {Channel}

export const CHANNELS_PAGE_SIZE = 20
const CONCURRENCY = 6

type Filter = {field: (string | number)[]; operator: string; value: unknown}

function values(filters: Filter[], field: string): string[] {
	return filters
		.filter((f) => f.field[0] === field)
		.flatMap((f) =>
			f.operator === 'in' ? (f.value as string[]) : f.operator === 'eq' ? [f.value as string] : []
		)
}

function parseChannelParams(opts: Parameters<typeof parseLoadSubsetOptions>[0]) {
	let filters: Filter[] = []
	let limit: number | undefined
	try {
		const parsed = parseLoadSubsetOptions(opts) as {filters: Filter[]; limit?: number}
		filters = parsed.filters
		limit = parsed.limit
	} catch {
		// No subset options: browse everything
	}
	const actors = [...values(filters, 'id'), ...values(filters, 'slug')]
	const geo = ['latitude', 'longitude'].every((field) =>
		filters.some((f) => f.field[0] === field && f.operator === 'not_isNull')
	)
	return {actors, limit, geo}
}

/** Run async tasks with bounded concurrency, preserving order */
async function mapLimit<T, R>(items: T[], fn: (item: T) => Promise<R>): Promise<R[]> {
	const results = new Array<R>(items.length)
	let next = 0
	const workers = Array.from({length: Math.min(CONCURRENCY, items.length)}, async () => {
		while (next < items.length) {
			const i = next++
			results[i] = await fn(items[i])
		}
	})
	await Promise.all(workers)
	return results
}

async function profilesByDid(dids: string[]): Promise<Map<string, Profile>> {
	const profiles: Profile[] = await getProfiles(dids).catch(() => [])
	return new Map(profiles.map((p) => [p.did, p] as const))
}

async function loadChannel(owner: Identity, profile?: Profile): Promise<Channel> {
	const [record, latest] = await Promise.all([
		getRecord<ChannelRecord>(owner.did, CHANNEL, SELF).catch(() => null),
		listRecords<TrackRecord>(owner.did, TRACK, {limit: 1}).catch(() => null)
	])
	const channel = channelFrom(owner, record?.value, profile)
	channel.latest_track_at = latest?.records[0]?.value.createdAt ?? null
	return channel
}

/** Channels for handles or DIDs */
export async function fetchChannels(actors: string[]): Promise<Channel[]> {
	const owners = (await mapLimit(actors, (a) => resolveIdentity(a).catch(() => null))).filter(
		(o): o is Identity => Boolean(o)
	)
	const profiles = await profilesByDid(owners.map((o) => o.did))
	return mapLimit(owners, (o) => loadChannel(o, profiles.get(o.did)))
}

/** DIDs of every repo holding radio.4000.track records, as indexed by the relay */
export function fetchRadioDids(): Promise<string[]> {
	return queryClient.query({
		queryKey: ['radio-dids'],
		staleTime: 5 * 60 * 1000,
		queryFn: async () => {
			const dids: string[] = []
			let cursor: string | undefined
			do {
				const page = await xrpcGet<{repos: {did: string}[]; cursor?: string}>(
					app.services.relay,
					'com.atproto.sync.listReposByCollection',
					{collection: TRACK, limit: 500, cursor}
				)
				dids.push(...page.repos.map((r) => r.did))
				cursor = page.repos.length ? page.cursor : undefined
			} while (cursor)
			return dids
		}
	})
}

export const channelsCollection = createCollection<Channel, string>({
	...queryCollectionOptions({
		queryKey: (opts) => {
			// Every key extends the base key: ['channels'], browsing everything
			const {actors, limit, geo} = parseChannelParams(opts)
			if (actors.length) return ['channels', ...actors.toSorted()]
			if (!limit && !geo) return ['channels']
			return ['channels', 'browse', geo ? 'geo' : 'all', limit ?? 'all']
		},
		syncMode: 'on-demand',
		startSync: true,
		queryClient,
		getKey: (item) => item.id,
		staleTime: 5 * 60 * 1000,
		queryFn: async (ctx): Promise<Channel[]> => {
			const {actors, limit} = parseChannelParams(ctx.meta?.loadSubsetOptions)
			if (actors.length) return fetchChannels(actors)
			const dids = await fetchRadioDids()
			return fetchChannels(limit ? dids.slice(0, limit) : dids)
		}
	})
})

/** Merge changes into the signed-in account's channel record (and optional new image). */
export async function updateChannel(changes: Partial<Channel>, image?: File) {
	const did = myDid()
	if (!did) throw new Error('Not signed in')
	const existing = await getRecord<ChannelRecord>(did, CHANNEL, SELF)
	const record = channelToRecord(changes, existing?.value)
	if (image) record.image = (await uploadBlob(image)) as unknown as ChannelRecord['image']
	await putRecord(CHANNEL, SELF, record)
	const [channel] = await fetchChannels([did])
	if (!channelsCollection.isReady()) channelsCollection.startSyncImmediate()
	channelsCollection.utils.writeUpsert(channel)
	return channel
}
