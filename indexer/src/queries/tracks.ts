/** radio.4000.listTracks: the network's tracks, newest first, optionally filtered */
import type {Db} from '../db'
import {decodeCursor, encodeCursor, ftsQuery} from '../search'
import {recordView, type RecordRow} from '../views'

export async function listTracks(
	db: Db,
	params: {
		radios?: string[]
		tags?: string[]
		mention?: string
		q?: string
		limit: number
		cursor?: string
	}
) {
	const where: string[] = []
	const binds: unknown[] = []
	if (params.radios?.length) {
		where.push('t.did IN (SELECT value FROM json_each(?))')
		binds.push(JSON.stringify(params.radios))
	}
	for (const tag of params.tags ?? []) {
		where.push('EXISTS (SELECT 1 FROM track_tags g WHERE g.uri = t.uri AND g.tag = ?)')
		binds.push(tag.replace(/^#/, '').toLowerCase())
	}
	if (params.mention) {
		where.push('EXISTS (SELECT 1 FROM track_mentions m WHERE m.uri = t.uri AND m.handle = ?)')
		binds.push(params.mention.replace(/^@/, '').toLowerCase())
	}
	const match = ftsQuery(params.q)
	if (match) {
		where.push('t.rowid IN (SELECT rowid FROM tracks_fts WHERE tracks_fts MATCH ?)')
		binds.push(match)
	}
	const after = decodeCursor(params.cursor)
	if (after) {
		where.push('(t.created_at < ? OR (t.created_at = ? AND t.uri < ?))')
		binds.push(after.createdAt, after.createdAt, after.uri)
	}
	const {results} = await db
		.prepare(
			`SELECT t.uri, t.cid, t.did, a.handle, t.record, t.created_at, t.indexed_at
			FROM tracks t JOIN accounts a ON a.did = t.did
			${where.length ? `WHERE ${where.join(' AND ')}` : ''}
			ORDER BY t.created_at DESC, t.uri DESC LIMIT ?`
		)
		.bind(...binds, params.limit + 1)
		.all<RecordRow & {created_at: string}>()
	const page = results.slice(0, params.limit)
	const last = page.at(-1)
	return {
		tracks: page.map(recordView),
		cursor: results.length > params.limit && last ? encodeCursor(last) : undefined
	}
}
