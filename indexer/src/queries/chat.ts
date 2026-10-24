/** radio.4000.chat.listMessages: a room's messages, newest first */
import type {Db} from '../db'
import {decodeCursor, encodeCursor} from '../search'
import {recordView, type RecordRow} from '../views'

export async function listMessages(
	db: Db,
	params: {radio: string; limit: number; cursor?: string}
) {
	const where = ['c.subject = ?']
	const binds: unknown[] = [params.radio]
	const after = decodeCursor(params.cursor)
	if (after) {
		where.push('(c.created_at, c.uri) < (?, ?)')
		binds.push(after.createdAt, after.uri)
	}
	const {results} = await db
		.prepare(
			`SELECT c.uri, c.cid, c.did, a.handle, c.record, c.created_at, c.indexed_at
			FROM chat_messages c JOIN accounts a ON a.did = c.did
			WHERE ${where.join(' AND ')} ORDER BY c.created_at DESC, c.uri DESC LIMIT ?`
		)
		.bind(...binds, params.limit + 1)
		.all<RecordRow & {created_at: string}>()
	const page = results.slice(0, params.limit)
	const last = page.at(-1)
	return {
		messages: page.map(recordView),
		cursor: results.length > params.limit && last ? encodeCursor(last) : undefined
	}
}
