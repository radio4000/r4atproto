/** Words typed by people, as an FTS5 query: every word, as a prefix ("dub techno" → "dub"* "techno"*) */
export function ftsQuery(q: string | undefined): string | undefined {
	const words = (q ?? '').match(/[\p{L}\p{N}]+/gu)
	return words?.length ? words.map((word) => `"${word}"*`).join(' ') : undefined
}

/** Cursors over (created_at, uri), newest first */
export function encodeCursor(row: {created_at: string; uri: string}) {
	return `${row.created_at}|${row.uri}`
}

export function decodeCursor(cursor: string | undefined) {
	if (!cursor) return undefined
	const at = cursor.indexOf('|')
	return at > 0 ? {createdAt: cursor.slice(0, at), uri: cursor.slice(at + 1)} : undefined
}

/** Cursors that are offsets, for rankings that change as rows update */
export const offsetOf = (cursor: string | undefined) =>
	Math.max(0, Number.parseInt(cursor ?? '0', 10) || 0)
