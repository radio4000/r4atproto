/**
 * Reading whole repos into the index: every account holding our records, at first
 * start (listed by the relay), and any account the live ingest meets for the first time.
 */
import app from '#lib/config/app.json' with {type: 'json'}
import {CHAT_MESSAGE, CHANNEL, TRACK} from '#lib/lexicons.js'
import {xrpcGet} from '#lib/atproto/xrpc.js'
import type {Identity} from '#lib/atproto/identity.js'
import type {Db} from './db'
import {INDEXED} from './events'
import {isValidRecord} from './lexicons'
import {applyChanges, type Change} from './store'

const PAGE = 100

/** Every repo holding records of our collections, as the relay lists them */
export async function listIndexedRepos(): Promise<string[]> {
	const dids = new Set<string>()
	for (const collection of [CHANNEL, TRACK, CHAT_MESSAGE]) {
		let cursor: string | undefined
		do {
			const page = await xrpcGet<{repos: {did: string}[]; cursor?: string}>(
				app.services.relay,
				'com.atproto.sync.listReposByCollection',
				{collection, limit: 1000, cursor}
			)
			for (const repo of page.repos) dids.add(repo.did)
			cursor = page.repos.length ? page.cursor : undefined
		} while (cursor)
	}
	return [...dids]
}

type Listed = {uri: string; cid: string; value: Record<string, unknown>}

/**
 * Read an account's records of our collections and replace what the index has of it.
 * Rows of the account not seen in this read (deleted meanwhile) are removed.
 */
export async function backfillRepo(db: Db, identity: Identity) {
	const started = new Date().toISOString()
	const identities = new Map([[identity.did, identity]])
	for (const collection of INDEXED) {
		let cursor: string | undefined
		do {
			const page = await xrpcGet<{records: Listed[]; cursor?: string}>(
				identity.pds,
				'com.atproto.repo.listRecords',
				{repo: identity.did, collection, limit: PAGE, cursor}
			)
			const changes: Change[] = page.records.flatMap((r) =>
				isValidRecord(collection, r.value)
					? [
							{
								action: 'upsert' as const,
								collection,
								did: identity.did,
								rkey: r.uri.split('/').pop()!,
								cid: r.cid,
								record: r.value
							}
						]
					: []
			)
			await applyChanges(db, changes, identities, started)
			cursor = page.records.length ? page.cursor : undefined
		} while (cursor)
	}
	await sweep(db, identity.did, started)
}

/** Remove an account's rows indexed before `started`: gone from its repo */
async function sweep(db: Db, did: string, started: string) {
	await db.batch([
		db
			.prepare(
				'DELETE FROM track_tags WHERE uri IN (SELECT uri FROM tracks WHERE did = ? AND indexed_at < ?)'
			)
			.bind(did, started),
		db
			.prepare(
				'DELETE FROM track_mentions WHERE uri IN (SELECT uri FROM tracks WHERE did = ? AND indexed_at < ?)'
			)
			.bind(did, started),
		db.prepare('DELETE FROM tracks WHERE did = ? AND indexed_at < ?').bind(did, started),
		db.prepare('DELETE FROM chat_messages WHERE did = ? AND indexed_at < ?').bind(did, started),
		db.prepare('DELETE FROM broadcasts WHERE did = ? AND indexed_at < ?').bind(did, started),
		db
			.prepare(
				'UPDATE radios SET record = NULL, name = NULL, description = NULL, latitude = NULL, longitude = NULL WHERE did = ? AND indexed_at < ?'
			)
			.bind(did, started),
		db
			.prepare(
				`UPDATE radios SET track_count = (SELECT count(*) FROM tracks WHERE did = ?),
					latest_track_at = (SELECT max(created_at) FROM tracks WHERE did = ?) WHERE did = ?`
			)
			.bind(did, did, did)
	])
}
