/**
 * Who is out of a chat room. Blocks are public Bluesky records (app.bsky.graph.block):
 * accounts the radio's owner blocks are out of its room, and accounts you block are out
 * of every room you read.
 */
import app from '#lib/config/app.json' with {type: 'json'}
import {BSKY_BLOCK} from '#lib/lexicons.js'
import {listRecords} from '#lib/atproto/repo.js'

interface BlockRecord {
	subject?: unknown
}

const blocks = new Map<string, Promise<Set<string>>>()

/** Accounts an account blocks, from its repo. Long lists are read up to chat.blockListPages. */
export function blockedBy(did: string): Promise<Set<string>> {
	let promise = blocks.get(did)
	if (!promise) {
		promise = (async () => {
			const dids = new Set<string>()
			let cursor: string | undefined
			for (let page = 0; page < app.chat.blockListPages; page++) {
				const result = await listRecords<BlockRecord>(did, BSKY_BLOCK, {cursor})
				for (const {value} of result.records) {
					if (typeof value.subject === 'string') dids.add(value.subject)
				}
				cursor = result.cursor
				if (!cursor) break
			}
			return dids
		})().catch(() => new Set<string>())
		blocks.set(did, promise)
	}
	return promise
}

/** Accounts kept out of a radio's room: the owner's blocks, and the reader's own */
export async function roomBlocks(radioDid: string, readerDid?: string): Promise<Set<string>> {
	const lists = await Promise.all([radioDid, readerDid].flatMap((did) => (did ? blockedBy(did) : [])))
	return new Set(lists.flatMap((list) => [...list]))
}
