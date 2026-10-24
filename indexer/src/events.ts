/**
 * Jetstream events into the index. Commits to our collections become record
 * changes; identity and account events keep known accounts current. Accounts seen
 * for the first time are backfilled, so their older records join the index.
 */
import {BROADCAST, CHANNEL, CHAT_MESSAGE, TRACK} from '#lib/lexicons.js'
import type {Identity} from '#lib/atproto/identity.js'
import type {Db} from './db'
import {isValidRecord} from './lexicons'
import {applyChanges, removeAccount, updateHandle, type Change} from './store'

export const INDEXED = new Set([CHANNEL, TRACK, BROADCAST, CHAT_MESSAGE])

export interface JetstreamEvent {
	did: string
	time_us: number
	kind: 'commit' | 'identity' | 'account'
	commit?: {
		operation: 'create' | 'update' | 'delete'
		collection: string
		rkey: string
		cid?: string
		record?: Record<string, unknown>
	}
	account?: {active: boolean}
}

export interface EventDeps {
	/** Verified identity of an account (fresh, not cached) */
	resolve: (did: string) => Promise<Identity>
	/** Read an account's whole repo into the index, later */
	backfill: (did: string) => Promise<void>
}

/** A commit to one of our collections as a change, or null (other collection, invalid record) */
export function changeOf(event: JetstreamEvent): Change | null {
	const commit = event.commit
	if (event.kind !== 'commit' || !commit || !INDEXED.has(commit.collection)) return null
	const {did} = event
	const {collection, rkey} = commit
	if (commit.operation === 'delete') return {action: 'delete', collection, did, rkey}
	if (!commit.cid || !isValidRecord(collection, commit.record)) return null
	return {action: 'upsert', collection, did, rkey, cid: commit.cid, record: commit.record!}
}

/** Identities the index has for these accounts */
export async function storedIdentities(db: Db, dids: string[]): Promise<Map<string, Identity>> {
	const {results} = await db
		.prepare('SELECT did, handle, pds FROM accounts WHERE did IN (SELECT value FROM json_each(?))')
		.bind(JSON.stringify(dids))
		.all<Identity>()
	return new Map(results.map((row) => [row.did, row]))
}

/** Apply a batch of events, in order */
export async function processEvents(db: Db, events: JetstreamEvent[], deps: EventDeps) {
	const changes = events.flatMap((event) => changeOf(event) ?? [])
	const dids = [...new Set(changes.map((c) => c.did))]
	const identities = await storedIdentities(db, dids)
	for (const did of dids) {
		if (identities.has(did)) continue
		try {
			identities.set(did, await deps.resolve(did))
			await deps.backfill(did)
		} catch {
			// Unresolvable account: its records wait for a later event
		}
	}
	await applyChanges(
		db,
		changes.filter((c) => identities.has(c.did)),
		identities
	)

	// Only accounts the index knows matter; Jetstream sends these for the whole network
	const others = events.filter((e) => e.kind !== 'commit')
	if (!others.length) return
	const known = await storedIdentities(db, [...new Set(others.map((e) => e.did))])
	for (const event of others) {
		if (!known.has(event.did)) continue
		if (event.kind === 'account' && event.account?.active === false) {
			await removeAccount(db, event.did)
		} else if (event.kind === 'account') {
			await deps.backfill(event.did)
		} else if (event.kind === 'identity') {
			const identity = await deps.resolve(event.did).catch(() => null)
			if (identity) await updateHandle(db, event.did, identity.handle)
		}
	}
}
