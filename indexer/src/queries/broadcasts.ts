/** radio.4000.listBroadcasts: radios live now, by latest heartbeat */
import app from '#lib/config/app.json' with {type: 'json'}
import type {Db} from '../db'
import {offsetOf} from '../search'
import {broadcastView, type RecordRow} from '../views'

export async function listBroadcasts(
	db: Db,
	params: {limit: number; cursor?: string},
	now = Date.now()
) {
	// A broadcast whose heartbeat stopped is over, even if its record is still there
	const since = new Date(now - app.broadcast.staleSeconds * 1000).toISOString()
	const offset = offsetOf(params.cursor)
	const {results} = await db
		.prepare(
			`SELECT b.did, a.handle, b.record, b.indexed_at FROM broadcasts b JOIN accounts a ON a.did = b.did
			WHERE b.updated_at >= ? ORDER BY b.updated_at DESC LIMIT ? OFFSET ?`
		)
		.bind(since, params.limit + 1, offset)
		.all<Omit<RecordRow, 'uri' | 'cid'>>()
	return {
		broadcasts: results.slice(0, params.limit).map(broadcastView),
		cursor: results.length > params.limit ? String(offset + params.limit) : undefined
	}
}
