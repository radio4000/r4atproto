/**
 * Live broadcasts, keyed by channel DID. Read once from every radio's
 * radio.4000.broadcast record, then kept current from Jetstream. A record
 * whose heartbeat (updatedAt) is older than broadcast.staleSeconds is over:
 * its tab probably closed without deleting it.
 */
import {createCollection} from '@tanstack/svelte-db'
import {localOnlyCollectionOptions} from '@tanstack/db'
import app from '#lib/config/app.json' with {type: 'json'}
import {BROADCAST, SELF} from '#lib/lexicons.js'
import {getRecord} from '#lib/atproto/repo.js'
import {subscribe} from '#lib/atproto/jetstream.js'
import {broadcastFromRecord, type BroadcastRecord} from '#lib/atproto/records.js'
import type {Broadcast} from '#lib/types.js'
import {fetchRadioDids} from './channels'

const CONCURRENCY = 6

export const broadcastsCollection = createCollection(
	localOnlyCollectionOptions({
		id: 'broadcasts',
		getKey: (item: Broadcast) => item.channel_id
	})
)

export function isFresh(broadcast: Pick<Broadcast, 'updated_at'>): boolean {
	const updated = broadcast.updated_at ? Date.parse(broadcast.updated_at) : 0
	return Date.now() - updated < app.broadcast.staleSeconds * 1000
}

export function upsertBroadcast(broadcast: Broadcast) {
	if (!isFresh(broadcast)) return removeBroadcast(broadcast.channel_id)
	if (broadcastsCollection.has(broadcast.channel_id)) {
		broadcastsCollection.update(broadcast.channel_id, (draft) => Object.assign(draft, broadcast))
	} else {
		broadcastsCollection.insert(broadcast)
	}
}

export function removeBroadcast(did: string) {
	if (broadcastsCollection.has(did)) broadcastsCollection.delete(did)
}

/** The current broadcast of one radio, from its PDS */
export async function fetchBroadcast(did: string): Promise<Broadcast | null> {
	const record = await getRecord<BroadcastRecord>(did, BROADCAST, SELF).catch(() => null)
	return record ? broadcastFromRecord(did, record.value) : null
}

async function loadBroadcasts() {
	const dids = await fetchRadioDids()
	for (let i = 0; i < dids.length; i += CONCURRENCY) {
		const found = await Promise.all(dids.slice(i, i + CONCURRENCY).map(fetchBroadcast))
		for (const broadcast of found) if (broadcast) upsertBroadcast(broadcast)
	}
}

let started = false

/** Start following broadcasts, once per page */
export function watchBroadcasts() {
	if (started || typeof window === 'undefined') return
	started = true
	loadBroadcasts().catch((error) => console.warn('broadcasts: initial load failed', error))
	subscribe<BroadcastRecord>([BROADCAST], ({did, commit}) => {
		if (commit.rkey !== SELF) return
		if (commit.operation === 'delete') removeBroadcast(did)
		else if (commit.record) upsertBroadcast(broadcastFromRecord(did, commit.record))
	})
	setInterval(() => {
		for (const broadcast of broadcastsCollection.values()) {
			if (!isFresh(broadcast)) removeBroadcast(broadcast.channel_id)
		}
	}, 30_000)
}
