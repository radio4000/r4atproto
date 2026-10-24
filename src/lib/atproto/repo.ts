/**
 * Public reads from a repo, straight from its PDS.
 *
 * Identical reads share one request and are reused for reads.cacheSeconds: pages
 * ask for the same records from several queries, and PDSes rate-limit by IP.
 * Writes clear the cache of the collection they touch (invalidateRepoCache).
 */
import app from '../config/app.json' with {type: 'json'}
import {resolvePds} from './identity'
import {xrpcGet, type XrpcParams} from './xrpc'

const cache = new Map<string, {at: number; promise: Promise<unknown>}>()

function cachedGet<T>(
	did: string,
	collection: string,
	nsid: string,
	params: XrpcParams
): Promise<T> {
	const key = JSON.stringify([did, collection, nsid, params])
	const hit = cache.get(key)
	if (hit && Date.now() - hit.at < app.reads.cacheSeconds * 1000) return hit.promise as Promise<T>
	const promise = resolvePds(did).then((pds) => xrpcGet<T>(pds, nsid, params))
	promise.catch(() => cache.delete(key))
	cache.set(key, {at: Date.now(), promise})
	return promise
}

/** Forget cached reads of a collection, after writing to it */
export function invalidateRepoCache(did: string, collection: string) {
	const prefix = JSON.stringify([did, collection]).slice(0, -1)
	for (const key of cache.keys()) if (key.startsWith(prefix)) cache.delete(key)
}

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
	return cachedGet(did, collection, 'com.atproto.repo.listRecords', {
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
	try {
		return await cachedGet(did, collection, 'com.atproto.repo.getRecord', {
			repo: did,
			collection,
			rkey
		})
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
