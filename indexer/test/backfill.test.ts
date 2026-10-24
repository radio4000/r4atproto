// @vitest-environment node
import {expect, test, vi} from 'vitest'
import {testDb} from './sqlite-db'

const alice = {did: 'did:plc:alice', handle: 'alice.test', pds: 'https://pds.test'}
const at = (rkey: string) => `at://${alice.did}/radio.4000.track/${rkey}`
const track = (title: string) => ({
	url: 'https://youtu.be/x',
	title,
	createdAt: '2026-01-01T00:00:00.000Z'
})
let repo: Record<string, {uri: string; cid: string; value: object}[]> = {}

vi.mock('#lib/atproto/xrpc.js', () => ({
	xrpcGet: async (
		_service: string,
		_nsid: string,
		{collection, cursor}: {collection: string; cursor?: string}
	) => {
		const records = repo[collection] ?? []
		// Two pages, to follow cursors
		return cursor
			? {records: records.slice(1)}
			: {records: records.slice(0, 1), cursor: records.length > 1 ? 'next' : undefined}
	}
}))

const {backfillRepo} = await import('../src/backfill')

test('reads every page of a repo, and removes what it no longer has', async () => {
	const db = testDb()
	repo = {
		'radio.4000.track': [
			{uri: at('1'), cid: 'c1', value: track('One')},
			{uri: at('2'), cid: 'c2', value: track('Two')},
			{uri: at('3'), cid: 'c3', value: {title: 'invalid'}}
		]
	}
	await backfillRepo(db, alice)
	expect(db.sqlite.prepare('SELECT title FROM tracks ORDER BY title').all()).toEqual([
		{title: 'One'},
		{title: 'Two'}
	])

	await new Promise((resolve) => setTimeout(resolve, 5))
	repo = {'radio.4000.track': [{uri: at('2'), cid: 'c2', value: track('Two')}]}
	await backfillRepo(db, alice)
	expect(db.sqlite.prepare('SELECT title FROM tracks').all()).toEqual([{title: 'Two'}])
	expect(db.sqlite.prepare('SELECT track_count FROM radios').get()).toEqual({track_count: 1})
})
