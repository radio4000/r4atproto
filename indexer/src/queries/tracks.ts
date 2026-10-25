/**
 * radio.4000.listTracks: the network's tracks, newest first, optionally filtered.
 *
 * Each read starts from the index that narrows it most and stops after a page, so
 * a page costs about the same whatever the size of the network:
 * - given radios: their tracks (tracks_radio);
 * - else a #tag, or an @mention: its tracks, newest first (track_tags_feed, track_mentions_feed);
 * - else words: full-text search, keyed by seq so it too reads newest first;
 * - else all tracks, newest first (tracks_created).
 * Words given with radios, a tag or a mention are matched in those tracks' text.
 */
import type {Db} from '../db'
import {decodeCursor, encodeCursor, ftsQuery} from '../search'
import {recordView, type RecordRow} from '../views'

interface Params {
	radios?: string[]
	tags?: string[]
	mention?: string
	q?: string
	limit: number
	cursor?: string
}

type Row = RecordRow & {created_at: string; seq: number}

const COLUMNS = 't.uri, t.cid, t.did, a.handle, t.record, t.created_at, t.seq, t.indexed_at'

/** Words of a query, lowercase */
const words = (q: string | undefined) => (q ?? '').toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []

function page(results: Row[], limit: number, cursorOf: (row: Row) => string) {
	const rows = results.slice(0, limit)
	const last = rows.at(-1)
	return {
		tracks: rows.map(recordView),
		cursor: results.length > limit && last ? cursorOf(last) : undefined
	}
}

/** Words alone: the newest matches, straight from the full-text index */
async function byWords(db: Db, match: string, limit: number, cursor?: string) {
	const before = cursor?.startsWith('s:') ? Number(cursor.slice(2)) : undefined
	const {results} = await db
		.prepare(
			`SELECT ${COLUMNS} FROM tracks t JOIN accounts a ON a.did = t.did
			WHERE t.seq IN (
				SELECT rowid FROM tracks_fts WHERE tracks_fts MATCH ?
				${before ? 'AND rowid < ?' : ''} ORDER BY rowid DESC LIMIT ?
			)
			ORDER BY t.seq DESC`
		)
		.bind(...(before ? [match, before] : [match]), limit + 1)
		.all<Row>()
	return page(results, limit, (row) => `s:${row.seq}`)
}

export async function listTracks(db: Db, params: Params) {
	const tags = (params.tags ?? []).map((tag) => tag.replace(/^#/, '').toLowerCase())
	const mention = params.mention?.replace(/^@/, '').toLowerCase()
	const match = ftsQuery(params.q)
	const start = params.radios?.length
		? 'radios'
		: tags.length
			? 'tag'
			: mention
				? 'mention'
				: match
					? 'words'
					: 'all'
	if (start === 'words') return byWords(db, match!, params.limit, params.cursor)

	const where: string[] = []
	const binds: unknown[] = []
	// The rows walked newest first: tracks, or a tag's or mention's rows (d) joined to them
	const from = {
		radios: 'tracks t',
		tag: 'track_tags d JOIN tracks t ON t.uri = d.uri',
		mention: 'track_mentions d JOIN tracks t ON t.uri = d.uri',
		all: 'tracks t'
	}[start]
	const order = start === 'tag' || start === 'mention' ? 'd' : 't'

	if (start === 'radios') {
		where.push('t.did IN (SELECT value FROM json_each(?))')
		binds.push(JSON.stringify(params.radios))
	}
	if (start === 'tag') {
		where.push('d.tag = ?')
		binds.push(tags[0])
	}
	if (start === 'mention') {
		where.push('d.handle = ?')
		binds.push(mention)
	}
	for (const tag of start === 'tag' ? tags.slice(1) : tags) {
		where.push('EXISTS (SELECT 1 FROM track_tags g WHERE g.uri = t.uri AND g.tag = ?)')
		binds.push(tag)
	}
	if (mention && start !== 'mention') {
		where.push('EXISTS (SELECT 1 FROM track_mentions m WHERE m.uri = t.uri AND m.handle = ?)')
		binds.push(mention)
	}
	for (const word of words(params.q)) {
		where.push("lower(t.title || ' ' || coalesce(t.description, '')) LIKE ?")
		binds.push(`%${word}%`)
	}
	const after = decodeCursor(params.cursor)
	if (after) {
		// A row value, so the walk resumes from the index
		where.push(`(${order}.created_at, ${order}.uri) < (?, ?)`)
		binds.push(after.createdAt, after.uri)
	}

	const {results} = await db
		.prepare(
			`SELECT ${COLUMNS} FROM ${from} JOIN accounts a ON a.did = t.did
			${where.length ? `WHERE ${where.join(' AND ')}` : ''}
			ORDER BY ${order}.created_at DESC, ${order}.uri DESC LIMIT ?`
		)
		.bind(...binds, params.limit + 1)
		.all<Row>()
	return page(results, params.limit, encodeCursor)
}
