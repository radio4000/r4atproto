/**
 * Public reads from a repo, straight from its PDS.
 */
import {resolvePds} from './identity'
import {xrpcGet} from './xrpc'

export interface RepoRecord<T = unknown> {
	uri: string
	cid: string
	value: T
}

export interface ListRecordsOptions {
	limit?: number
	cursor?: string
	/** Oldest first. Without it the PDS returns newest first. */
	reverse?: boolean
}

export async function listRecords<T>(
	did: string,
	collection: string,
	{limit = 100, cursor, reverse}: ListRecordsOptions = {}
): Promise<{records: RepoRecord<T>[]; cursor?: string}> {
	const pds = await resolvePds(did)
	return xrpcGet(pds, 'com.atproto.repo.listRecords', {
		repo: did,
		collection,
		limit,
		cursor,
		reverse
	})
}

/** Every record of a collection, newest first */
export async function listAllRecords<T>(did: string, collection: string): Promise<RepoRecord<T>[]> {
	const all: RepoRecord<T>[] = []
	let cursor: string | undefined
	do {
		const page = await listRecords<T>(did, collection, {cursor})
		all.push(...page.records)
		cursor = page.records.length ? page.cursor : undefined
	} while (cursor)
	return all
}

/** One record, or null when it doesn't exist */
export async function getRecord<T>(
	did: string,
	collection: string,
	rkey: string
): Promise<RepoRecord<T> | null> {
	const pds = await resolvePds(did)
	try {
		return await xrpcGet(pds, 'com.atproto.repo.getRecord', {repo: did, collection, rkey})
	} catch (err) {
		if ((err as {error?: string}).error === 'RecordNotFound') return null
		throw err
	}
}

/** URL of a blob (e.g. a channel image) on its PDS */
export async function blobUrl(did: string, cid: string): Promise<string> {
	const pds = await resolvePds(did)
	return `${pds}/xrpc/com.atproto.sync.getBlob?did=${encodeURIComponent(did)}&cid=${encodeURIComponent(cid)}`
}

/** Parse at://did/collection/rkey */
export function parseAtUri(uri: string): {did: string; collection: string; rkey: string} {
	const [did, collection, rkey] = uri.replace('at://', '').split('/')
	if (!did || !collection || !rkey) throw new Error(`Invalid at:// URI: ${uri}`)
	return {did, collection, rkey}
}
