import {expect, test, vi} from 'vitest'

const pages: Record<string, {records: {value: unknown}[]; cursor?: string}> = {
	'did:plc:owner:': {records: [{value: {subject: 'did:plc:troll'}}], cursor: 'next'},
	'did:plc:owner:next': {records: [{value: {subject: 42}}, {value: {subject: 'did:plc:spam'}}]},
	'did:plc:reader:': {records: [{value: {subject: 'did:plc:ex'}}]}
}

vi.mock('#lib/atproto/repo.js', () => ({
	listRecords: async (did: string, _collection: string, {cursor = ''} = {}) => {
		const page = pages[`${did}:${cursor}`]
		if (!page) throw new Error('not found')
		return page
	}
}))

const {blockedBy, roomBlocks} = await import('./chat-blocks')

test('reads every page of an account’s blocks, keeping DIDs only', async () => {
	expect([...(await blockedBy('did:plc:owner'))]).toEqual(['did:plc:troll', 'did:plc:spam'])
})

test('a room keeps out the owner’s blocks and the reader’s', async () => {
	const blocked = await roomBlocks('did:plc:owner', 'did:plc:reader')
	expect([...blocked].sort()).toEqual(['did:plc:ex', 'did:plc:spam', 'did:plc:troll'])
})

test('an unreadable repo blocks no one', async () => {
	expect((await blockedBy('did:plc:gone')).size).toBe(0)
})
