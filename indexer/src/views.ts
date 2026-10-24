/** Index rows as the views of radio.4000.defs: each carries its record as in the repo */

export interface RadioRow {
	did: string
	handle: string
	pds: string
	record: string | null
	track_count: number
	latest_track_at: string | null
	indexed_at: string
}

export interface RecordRow {
	uri: string
	cid: string
	did: string
	handle: string
	record: string
	indexed_at: string
}

type Json = Record<string, unknown>

/** CID of a blob ref, in its JSON form ({ref: {$link}}) */
function blobCid(blob: unknown): string | undefined {
	const ref = (blob as {ref?: {$link?: unknown}} | undefined)?.ref
	return typeof ref?.$link === 'string' ? ref.$link : undefined
}

export function radioView(row: RadioRow) {
	const record = row.record ? (JSON.parse(row.record) as Json) : undefined
	const cid = blobCid(record?.image)
	return {
		did: row.did,
		handle: row.handle,
		record,
		image: cid
			? `${row.pds}/xrpc/com.atproto.sync.getBlob?did=${encodeURIComponent(row.did)}&cid=${cid}`
			: undefined,
		trackCount: row.track_count,
		latestTrackAt: row.latest_track_at ?? undefined,
		indexedAt: row.indexed_at
	}
}

/** A track or a chat message */
export function recordView(row: RecordRow) {
	return {
		uri: row.uri,
		cid: row.cid,
		author: {did: row.did, handle: row.handle},
		record: JSON.parse(row.record) as Json,
		indexedAt: row.indexed_at
	}
}

export function broadcastView(row: Omit<RecordRow, 'uri' | 'cid'>) {
	return {
		author: {did: row.did, handle: row.handle},
		record: JSON.parse(row.record) as Json,
		indexedAt: row.indexed_at
	}
}
