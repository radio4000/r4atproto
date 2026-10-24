/**
 * Writes to the signed-in account's repo. Each write clears the cached reads
 * of its collection, so the next read sees it.
 */
import {getAgent, getDid} from './oauth-client'
import {invalidateRepoCache} from './repo'

/** The agent and the DID of the signed-in repo */
function repo() {
	const agent = getAgent()
	const did = agent?.did
	if (!agent || !did) throw new Error('Not signed in')
	return {agent, did}
}

export function myDid(): string | undefined {
	return getDid()
}

export async function createRecord(collection: string, record: object, rkey?: string) {
	const {agent, did} = repo()
	const res = await agent.com.atproto.repo.createRecord({
		repo: did,
		collection,
		record: {...record},
		rkey
	})
	invalidateRepoCache(did, collection)
	return res.data
}

export async function putRecord(collection: string, rkey: string, record: object) {
	const {agent, did} = repo()
	const res = await agent.com.atproto.repo.putRecord({
		repo: did,
		collection,
		rkey,
		record: {...record}
	})
	invalidateRepoCache(did, collection)
	return res.data
}

export async function deleteRecord(collection: string, rkey: string) {
	const {agent, did} = repo()
	await agent.com.atproto.repo.deleteRecord({repo: did, collection, rkey})
	invalidateRepoCache(did, collection)
}

export async function uploadBlob(file: Blob) {
	const res = await repo().agent.com.atproto.repo.uploadBlob(file, {encoding: file.type})
	return res.data.blob
}

/** Create many records in one commit (a PDS accepts up to 200 writes per call) */
export async function createRecords(collection: string, items: {rkey: string; value: object}[]) {
	const {agent, did} = repo()
	await agent.com.atproto.repo.applyWrites({
		repo: did,
		writes: items.map(({rkey, value}) => ({
			$type: 'com.atproto.repo.applyWrites#create' as const,
			collection,
			rkey,
			value: {...value}
		}))
	})
	invalidateRepoCache(did, collection)
}
