/**
 * Writes to the index: record changes (from Jetstream or a backfill) and account
 * changes. Records arrive validated against our lexicons.
 */
import app from '#lib/config/app.json' with {type: 'json'}
import {BROADCAST, CHANNEL, CHAT_MESSAGE, SELF, TRACK} from '#lib/lexicons.js'
import {bareTags, extractMentions} from '#lib/entities.js'
import type {Identity} from '#lib/atproto/identity.js'
import type {Db, Statement} from './db'

type Json = Record<string, unknown>

export type Change =
	| {action: 'upsert'; collection: string; did: string; rkey: string; cid: string; record: Json}
	| {action: 'delete'; collection: string; did: string; rkey: string}

const uriOf = (c: {did: string; collection: string; rkey: string}) =>
	`at://${c.did}/${c.collection}/${c.rkey}`

const text = (value: unknown) => (typeof value === 'string' ? value : null)

/** Milliseconds of the latest date a track's key allows (2100), so keys stay exact integers */
const LAST_MS = Date.UTC(2100, 0, 1)

/** A new track's key: the first free slot of its millisecond (bound three times: start, from, below) */
export function seqRange(createdAt: string | null): [number, number, number] {
	const ms = Math.min(LAST_MS, Math.max(0, Date.parse(createdAt ?? '') || 0))
	return [ms * 1000, ms * 1000, ms * 1000 + 1000]
}

function coordinate(value: unknown): number | null {
	const number = typeof value === 'string' ? Number.parseFloat(value) : Number.NaN
	return Number.isFinite(number) ? number : null
}

/** Track upserts beyond a radio's cap (indexer.maxTracksPerRadio) are left out */
async function overCap(db: Db, changes: Change[]): Promise<Set<Change>> {
	const upserts = changes.filter((c) => c.action === 'upsert' && c.collection === TRACK)
	if (!upserts.length) return new Set()
	const dids = [...new Set(upserts.map((c) => c.did))]
	const [{results: counts}, {results: known}] = await Promise.all([
		db
			.prepare('SELECT did, track_count FROM radios WHERE did IN (SELECT value FROM json_each(?))')
			.bind(JSON.stringify(dids))
			.all<{did: string; track_count: number}>(),
		db
			.prepare('SELECT uri FROM tracks WHERE uri IN (SELECT value FROM json_each(?))')
			.bind(JSON.stringify(upserts.map(uriOf)))
			.all<{uri: string}>()
	])
	const room = new Map(dids.map((did) => [did, app.indexer.maxTracksPerRadio]))
	for (const {did, track_count} of counts)
		room.set(did, app.indexer.maxTracksPerRadio - track_count)
	const existing = new Set(known.map((row) => row.uri))
	const skipped = new Set<Change>()
	for (const change of upserts) {
		if (existing.has(uriOf(change))) continue
		const left = room.get(change.did) ?? 0
		if (left > 0) room.set(change.did, left - 1)
		else skipped.add(change)
	}
	return skipped
}

function statementsFor(db: Db, change: Change, now: string): Statement[] {
	const uri = uriOf(change)
	const {did} = change
	if (change.collection === CHANNEL && change.rkey === SELF) {
		if (change.action === 'delete') {
			return [
				db
					.prepare(
						'UPDATE radios SET record = NULL, name = NULL, description = NULL, latitude = NULL, longitude = NULL, indexed_at = ? WHERE did = ?'
					)
					.bind(now, did)
			]
		}
		const r = change.record
		const geo = (r.geo ?? {}) as Json
		return [
			db
				.prepare(
					'UPDATE radios SET record = ?, name = ?, description = ?, latitude = ?, longitude = ?, created_at = ?, indexed_at = ? WHERE did = ?'
				)
				.bind(
					JSON.stringify(r),
					text(r.name),
					text(r.description),
					coordinate(geo.latitude),
					coordinate(geo.longitude),
					text(r.createdAt),
					now,
					did
				)
		]
	}
	if (change.collection === TRACK) {
		const clear = [
			db.prepare('DELETE FROM track_tags WHERE uri = ?').bind(uri),
			db.prepare('DELETE FROM track_mentions WHERE uri = ?').bind(uri)
		]
		if (change.action === 'delete') {
			return [db.prepare('DELETE FROM tracks WHERE uri = ?').bind(uri), ...clear]
		}
		const r = change.record
		const description = text(r.description) ?? ''
		const createdAt = text(r.createdAt)
		return [
			db
				.prepare(
					`INSERT INTO tracks (uri, seq, did, cid, record, title, description, created_at, indexed_at)
					VALUES (?, (SELECT coalesce(max(seq) + 1, ?) FROM tracks WHERE seq >= ? AND seq < ?), ?, ?, ?, ?, ?, ?, ?)
					ON CONFLICT (uri) DO UPDATE SET cid = excluded.cid, record = excluded.record,
						title = excluded.title, description = excluded.description,
						created_at = excluded.created_at, indexed_at = excluded.indexed_at`
				)
				.bind(
					uri,
					...seqRange(createdAt),
					did,
					change.cid,
					JSON.stringify(r),
					text(r.title) ?? '',
					description,
					text(r.createdAt),
					now
				),
			...clear,
			...bareTags(description).map((tag) =>
				db
					.prepare('INSERT OR IGNORE INTO track_tags (tag, uri, created_at) VALUES (?, ?, ?)')
					.bind(tag, uri, createdAt)
			),
			...extractMentions(description).map((mention) =>
				db
					.prepare(
						'INSERT OR IGNORE INTO track_mentions (handle, uri, created_at) VALUES (?, ?, ?)'
					)
					.bind(mention.slice(1), uri, createdAt)
			)
		]
	}
	if (change.collection === BROADCAST && change.rkey === SELF) {
		if (change.action === 'delete')
			return [db.prepare('DELETE FROM broadcasts WHERE did = ?').bind(did)]
		return [
			db
				.prepare(
					`INSERT INTO broadcasts (did, record, updated_at, indexed_at) VALUES (?, ?, ?, ?)
					ON CONFLICT (did) DO UPDATE SET record = excluded.record, updated_at = excluded.updated_at, indexed_at = excluded.indexed_at`
				)
				.bind(did, JSON.stringify(change.record), text(change.record.updatedAt), now)
		]
	}
	if (change.collection === CHAT_MESSAGE) {
		if (change.action === 'delete')
			return [db.prepare('DELETE FROM chat_messages WHERE uri = ?').bind(uri)]
		const r = change.record
		return [
			db
				.prepare(
					`INSERT INTO chat_messages (uri, did, cid, subject, record, created_at, indexed_at)
					VALUES (?, ?, ?, ?, ?, ?, ?)
					ON CONFLICT (uri) DO UPDATE SET cid = excluded.cid, record = excluded.record, indexed_at = excluded.indexed_at`
				)
				.bind(uri, did, change.cid, text(r.subject), JSON.stringify(r), text(r.createdAt), now)
		]
	}
	return []
}

/**
 * Apply record changes in one transaction. `identities` holds the accounts the
 * changes belong to; a radio row is made for any account with a channel or tracks.
 */
export async function applyChanges(
	db: Db,
	changes: Change[],
	identities: Map<string, Identity>,
	now = new Date().toISOString()
) {
	const skipped = await overCap(db, changes)
	const kept = changes.filter((c) => !skipped.has(c))
	const statements: Statement[] = []
	for (const {did, handle, pds} of identities.values()) {
		statements.push(
			db
				.prepare(
					`INSERT INTO accounts (did, handle, pds, indexed_at) VALUES (?, ?, ?, ?)
					ON CONFLICT (did) DO UPDATE SET handle = excluded.handle, pds = excluded.pds`
				)
				.bind(did, handle, pds, now)
		)
	}
	const radioDids = new Set(
		kept
			.filter((c) => c.action === 'upsert' && (c.collection === CHANNEL || c.collection === TRACK))
			.map((c) => c.did)
	)
	for (const did of radioDids) {
		const identity = identities.get(did)
		if (!identity) continue
		statements.push(
			db
				.prepare(
					`INSERT INTO radios (did, handle, pds, indexed_at) VALUES (?, ?, ?, ?)
					ON CONFLICT (did) DO UPDATE SET handle = excluded.handle, pds = excluded.pds`
				)
				.bind(did, identity.handle, identity.pds, now)
		)
	}
	for (const change of kept) statements.push(...statementsFor(db, change, now))
	const tracksChanged = new Set(kept.filter((c) => c.collection === TRACK).map((c) => c.did))
	for (const did of tracksChanged) {
		statements.push(
			db
				.prepare(
					`UPDATE radios SET
						track_count = (SELECT count(*) FROM tracks WHERE did = ?),
						latest_track_at = (SELECT max(created_at) FROM tracks WHERE did = ?)
					WHERE did = ?`
				)
				.bind(did, did, did)
		)
	}
	if (statements.length) await db.batch(statements)
	return {applied: kept.length, skipped: skipped.size}
}

/** A new handle, verified by the caller */
export function updateHandle(db: Db, did: string, handle: string) {
	return db.batch([
		db.prepare('UPDATE accounts SET handle = ? WHERE did = ?').bind(handle, did),
		db.prepare('UPDATE radios SET handle = ? WHERE did = ?').bind(handle, did)
	])
}

/** Remove an account and everything of it (deactivated, taken down or deleted) */
export function removeAccount(db: Db, did: string) {
	return db.batch([
		db
			.prepare('DELETE FROM track_tags WHERE uri IN (SELECT uri FROM tracks WHERE did = ?)')
			.bind(did),
		db
			.prepare('DELETE FROM track_mentions WHERE uri IN (SELECT uri FROM tracks WHERE did = ?)')
			.bind(did),
		db.prepare('DELETE FROM tracks WHERE did = ?').bind(did),
		db.prepare('DELETE FROM radios WHERE did = ?').bind(did),
		db.prepare('DELETE FROM broadcasts WHERE did = ?').bind(did),
		db.prepare('DELETE FROM chat_messages WHERE did = ?').bind(did),
		db.prepare('DELETE FROM accounts WHERE did = ?').bind(did)
	])
}

/** DIDs of every account in the index */
export async function knownDids(db: Db): Promise<Set<string>> {
	const {results} = await db.prepare('SELECT did FROM accounts').all<{did: string}>()
	return new Set(results.map((row) => row.did))
}
