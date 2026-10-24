import {expect, test, vi} from 'vitest'

// What the AppView answers: who blocks whom
const relationships: Record<string, Record<string, object>> = {
	'did:plc:owner': {'did:plc:troll': {blocking: 'at://b'}, 'did:plc:hater': {blockedBy: 'at://c'}},
	'did:plc:reader': {'did:plc:ex': {blockingByList: 'at://l'}}
}
const xrpcGet = vi.fn(async (_service: string, _nsid: string, {actor, others}) => {
	if (actor === 'did:plc:down') throw new Error('unavailable')
	return {
		relationships: (others as string[]).map((did) => ({did, ...relationships[actor]?.[did]}))
	}
})
vi.mock('#lib/atproto/xrpc.js', () => ({xrpcGet}))

const {roomBlocks} = await import('./chat-blocks')

test('authors blocked by or blocking the owner, or the reader, are out', async () => {
	const authors = ['did:plc:troll', 'did:plc:hater', 'did:plc:ex', 'did:plc:friend']
	const blocked = await roomBlocks('did:plc:owner', 'did:plc:reader', authors)
	expect([...blocked].sort()).toEqual(['did:plc:ex', 'did:plc:hater', 'did:plc:troll'])
	expect([...(await roomBlocks('did:plc:owner', undefined, authors))].sort()).toEqual([
		'did:plc:hater',
		'did:plc:troll'
	])
})

test('asks once per pair, 30 authors per request', async () => {
	xrpcGet.mockClear()
	const authors = Array.from({length: 45}, (_, i) => `did:plc:a${i}`)
	await roomBlocks('did:plc:owner', undefined, authors)
	await roomBlocks('did:plc:owner', undefined, authors)
	expect(xrpcGet).toHaveBeenCalledTimes(2)
})

test('an unavailable AppView blocks no one', async () => {
	expect((await roomBlocks('did:plc:down', undefined, ['did:plc:x'])).size).toBe(0)
})
