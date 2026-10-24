/**
 * Public reads from repos.
 *
 * Single records are read through Slingshot (microcosm's public record cache), so
 * pages showing many radios don't hit each radio's PDS for every record; the PDS
 * is the fallback. Listings go to the PDS. Identical reads share one request and
 * are reused for reads.cacheSeconds; writes clear the cache of the collection
 * they touch (invalidateRepoCache).
 */
import app from '../config/app.json' with {type: 'json'}
import {resolvePds} from './identity'
import {isValidRecord} from './schemas'
import {xrpcGet, type XrpcParams} from './xrpc'

const cache = new Map<string, {at: number; promise: Promise<unknown>}>()

const isNotFound = (err: unknown) => (err as {error?: string}).error === 'RecordNotFound'

/** A single record from Slingshot, or from the PDS when Slingshot fails */
async function fromCacheOrPds<T>(did: string, nsid: string, params: XrpcParams): Promise<T> {
	try {
		return await xrpcGet<T>(app.services.slingshot, nsid, params)
	} catch (err) {
		if (isNotFound(err)) throw err
		return xrpcGet<T>(await resolvePds(did), nsid, params)
	}
}

function cachedGet<T>(
	did: string,
	collection: string,
	nsid: string,
	params: XrpcParams
): Promise<T> {
	const key = JSON.stringify([did, collection, nsid, params])
	const hit = cache.get(key)
	if (hit && Date.now() - hit.at < app.reads.cacheSeconds * 1000) return hit.promise as Promise<T>
	const promise =
		nsid === 'com.atproto.repo.getRecord'
			? fromCacheOrPds<T>(did, nsid, params)
			: resolvePds(did).then((pds) => xrpcGet<T>(pds, nsid, params))
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
	const page = await cachedGet<{records: RepoRecord<T>[]; cursor?: string}>(
		did,
		collection,
		'com.atproto.repo.listRecords',
		{repo: did, collection, limit, cursor, reverse}
	)
	// Records not matching their lexicon are dropped; the cursor still pages on,
	// until a page comes back empty
	return {
		records: page.records.filter((r) => isValidRecord(collection, r.value)),
		cursor: page.records.length ? page.cursor : undefined
	}
}

/** Every record of a collection, newest first */
export async function listAllRecords<T>(did: string, collection: string): Promise<RepoRecord<T>[]> {
	const all: RepoRecord<T>[] = []
	let cursor: string | undefined
	do {
		const page = await listRecords<T>(did, collection, {cursor})
		all.push(...page.records)
		cursor = page.cursor
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
		const record = await cachedGet<RepoRecord<T>>(did, collection, 'com.atproto.repo.getRecord', {
			repo: did,
			collection,
			rkey
		})
		return isValidRecord(collection, record.value) ? record : null
	} catch (err) {
		if (isNotFound(err)) return null
		throw err
	}
}

/** URL of a blob (e.g. a channel image) on its PDS */
export async function blobUrl(did: string, cid: string): Promise<string> {
	const pds = await resolvePds(did)
	return `${pds}/xrpc/com.atproto.sync.getBlob?did=${encodeURIComponent(did)}&cid=${encodeURIComponent(cid)}`
}

/** Parse at://did/collection/rkey */
/** Whether an id is a record (at:// URI), not a bare media id */
export const isRecordUri = (id: string) => id.startsWith('at://')

export function parseAtUri(uri: string): {did: string; collection: string; rkey: string} {
	const [did, collection, rkey] = uri.replace('at://', '').split('/')
	if (!did || !collection || !rkey) throw new Error(`Invalid at:// URI: ${uri}`)
	return {did, collection, rkey}
}
