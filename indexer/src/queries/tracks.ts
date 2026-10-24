/**
 * radio.4000.listTracks: the network's tracks, newest first, optionally filtered.
 *
 * Each read starts from the index that narrows it most, so a page costs about the
 * same whatever the size of the network:
 * - given radios: their tracks (tracks_radio), words matched in their text;
 * - else a #tag, or an @mention: its tracks, newest first (track_tags_feed, track_mentions_feed);
 * - else words: full-text search;
 * - else all tracks, newest first (tracks_created).
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

/** Words of a query, lowercase, for matching inside a few radios' tracks */
const words = (q: string | undefined) => (q ?? '').toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []

export async function listTracks(db: Db, params: Params) {
	const tags = (params.tags ?? []).map((tag) => tag.replace(/^#/, '').toLowerCase())
	const mention = params.mention?.replace(/^@/, '').toLowerCase()
	const start = params.radios?.length ? 'radios' : tags.length ? 'tag' : mention ? 'mention' : 'all'
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
		for (const word of words(params.q)) {
			where.push("lower(t.title || ' ' || coalesce(t.description, '')) LIKE ?")
			binds.push(`%${word}%`)
		}
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
	const match = start === 'radios' ? undefined : ftsQuery(params.q)
	if (match) {
		where.push('t.rowid IN (SELECT rowid FROM tracks_fts WHERE tracks_fts MATCH ?)')
		binds.push(match)
	}
	const after = decodeCursor(params.cursor)
	if (after) {
		// A row value, so the walk resumes from the index
		where.push(`(${order}.created_at, ${order}.uri) < (?, ?)`)
		binds.push(after.createdAt, after.uri)
	}

	const {results} = await db
		.prepare(
			`SELECT t.uri, t.cid, t.did, a.handle, t.record, t.created_at, t.indexed_at
			FROM ${from} JOIN accounts a ON a.did = t.did
			${where.length ? `WHERE ${where.join(' AND ')}` : ''}
			ORDER BY ${order}.created_at DESC, ${order}.uri DESC LIMIT ?`
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
