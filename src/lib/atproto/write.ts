/**
 * Writes to the signed-in account's repo.
 */
import {bskyOAuth} from '#lib/services/bsky-oauth.js'

function agent() {
	const a = bskyOAuth.agent
	if (!a?.did) throw new Error('Not signed in')
	return a
}

export function myDid(): string | undefined {
	return bskyOAuth.agent?.did
}

export async function createRecord(collection: string, record: object, rkey?: string) {
	const a = agent()
	const res = await a.com.atproto.repo.createRecord({
		repo: a.did!,
		collection,
		record: {...record},
		rkey
	})
	return res.data
}

export async function putRecord(collection: string, rkey: string, record: object) {
	const a = agent()
	const res = await a.com.atproto.repo.putRecord({
		repo: a.did!,
		collection,
		rkey,
		record: {...record}
	})
	return res.data
}

export async function deleteRecord(collection: string, rkey: string) {
	const a = agent()
	await a.com.atproto.repo.deleteRecord({repo: a.did!, collection, rkey})
}

export async function uploadBlob(file: Blob) {
	const res = await agent().com.atproto.repo.uploadBlob(file, {encoding: file.type})
	return res.data.blob
}

/** Create many records in one commit (a PDS accepts up to 200 writes per call) */
export async function createRecords(collection: string, items: {rkey: string; value: object}[]) {
	const a = agent()
	await a.com.atproto.repo.applyWrites({
		repo: a.did!,
		writes: items.map(({rkey, value}) => ({
			$type: 'com.atproto.repo.applyWrites#create' as const,
			collection,
			rkey,
			value: {...value}
		}))
	})
}
