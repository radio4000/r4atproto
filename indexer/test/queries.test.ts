// @vitest-environment node
import {describe, expect, test} from 'vitest'
import {applyChanges, type Change} from '../src/store'
import {handleXrpc} from '../src/xrpc'
import {lexicons} from '../src/lexicons'
import {testDb} from './sqlite-db'

const people = [
	{did: 'did:plc:alice', handle: 'alice.test', pds: 'https://pds.test'},
	{did: 'did:plc:bob', handle: 'bob.test', pds: 'https://pds.test'}
]
const ids = new Map(people.map((p) => [p.did, p]))
const upsert = (did: string, collection: string, rkey: string, record: object): Change => ({
	action: 'upsert',
	collection,
	did,
	rkey,
	cid: 'bafyreie5737gdxlw5i64vzichcalba3z2v5n6icifvx5xytvske7mr3hpm',
	record: record as never
})
const day = (n: number) => `2026-01-${String(n).padStart(2, '0')}T00:00:00.000Z`

async function seeded() {
	const db = testDb()
	await applyChanges(
		db,
		[
			upsert('did:plc:alice', 'radio.4000.channel', 'self', {
				name: 'Dub Station',
				geo: {latitude: '52.5', longitude: '13.4'},
				image: {$type: 'blob', ref: {$link: 'bafyimg'}, mimeType: 'image/png', size: 1},
				createdAt: day(1)
			}),
			upsert('did:plc:alice', 'radio.4000.track', 'a1', {
				url: 'https://youtu.be/1',
				title: 'King Tubby',
				description: '#dub #roots',
				createdAt: day(3)
			}),
			upsert('did:plc:alice', 'radio.4000.track', 'a2', {
				url: 'https://youtu.be/2',
				title: 'Basic Channel',
				description: '#dub #techno by @bob.test',
				createdAt: day(2)
			}),
			upsert('did:plc:bob', 'radio.4000.track', 'b1', {
				url: 'https://youtu.be/3',
				title: 'Coltrane',
				description: '#jazz',
				createdAt: day(4)
			}),
			upsert('did:plc:bob', 'radio.4000.chat.message', 'm1', {
				subject: 'did:plc:alice',
				text: 'nice',
				createdAt: day(5)
			}),
			upsert('did:plc:bob', 'radio.4000.broadcast', 'self', {
				decks: [],
				updatedAt: new Date().toISOString()
			})
		],
		ids
	)
	return db
}

type View = {
	handle: string
	image?: string
	author: {handle: string}
	record: {title?: string; text?: string}
}
type Answer = {
	radios: View[]
	tracks: View[]
	broadcasts: View[]
	messages: View[]
	cursor?: string
}

async function get(db: Awaited<ReturnType<typeof seeded>>, path: string) {
	const res = await handleXrpc(db, new URL(path, 'https://api.test'))
	return {status: res.status, body: (await res.json()) as Answer}
}

describe('xrpc queries', () => {
	test('listRadios sorts, searches and filters by area', async () => {
		const db = await seeded()
		const {body} = await get(db, '/xrpc/radio.4000.listRadios')
		expect(body.radios.map((r) => r.handle)).toEqual(['bob.test', 'alice.test'])
		expect(body.radios[1].image).toBe(
			'https://pds.test/xrpc/com.atproto.sync.getBlob?did=did%3Aplc%3Aalice&cid=bafyimg'
		)
		expect(
			(await get(db, '/xrpc/radio.4000.listRadios?q=stat')).body.radios.map((r) => r.handle)
		).toEqual(['alice.test'])
		expect(
			(await get(db, '/xrpc/radio.4000.listRadios?bbox=10,50,15,55')).body.radios
		).toHaveLength(1)
		expect((await get(db, '/xrpc/radio.4000.listRadios?sort=tracks&limit=1')).body).toMatchObject({
			cursor: '1'
		})
	})

	test('listTracks pages newest first, and filters by radio, tag, mention and words', async () => {
		const db = await seeded()
		const first = await get(db, '/xrpc/radio.4000.listTracks?limit=2')
		expect(first.body.tracks.map((t) => t.record.title)).toEqual(['Coltrane', 'King Tubby'])
		const next = await get(
			db,
			`/xrpc/radio.4000.listTracks?limit=2&cursor=${encodeURIComponent(first.body.cursor ?? '')}`
		)
		expect(next.body.tracks.map((t) => t.record.title)).toEqual(['Basic Channel'])
		expect(next.body.cursor).toBeUndefined()
		const titles = async (query: string) =>
			(await get(db, `/xrpc/radio.4000.listTracks?${query}`)).body.tracks.map((t) => t.record.title)
		expect(await titles('radios=did:plc:bob')).toEqual(['Coltrane'])
		expect(await titles('tags=dub&tags=techno')).toEqual(['Basic Channel'])
		expect(await titles('mention=bob.test')).toEqual(['Basic Channel'])
		expect(await titles('q=tub')).toEqual(['King Tubby'])
		expect(await titles('radios=did:plc:alice&q=tub')).toEqual(['King Tubby'])
		expect(await titles('radios=did:plc:bob&q=tub')).toEqual([])
		expect(await titles('tags=dub&q=basic')).toEqual(['Basic Channel'])
		// Descriptions count too: #dub is in King Tubby's
		const words = await get(db, '/xrpc/radio.4000.listTracks?q=dub&limit=1')
		expect(words.body.tracks.map((t) => t.record.title)).toEqual(['King Tubby'])
		const channel = await get(db, '/xrpc/radio.4000.listTracks?q=c&limit=1')
		expect(channel.body.tracks.map((t) => t.record.title)).toEqual(['Coltrane'])
		const more = await get(
			db,
			`/xrpc/radio.4000.listTracks?q=c&limit=1&cursor=${channel.body.cursor}`
		)
		expect(more.body.tracks.map((t) => t.record.title)).toEqual(['Basic Channel'])
		const byTag = await get(db, '/xrpc/radio.4000.listTracks?tags=dub&limit=1')
		expect(byTag.body.tracks.map((t) => t.record.title)).toEqual(['King Tubby'])
		const nextByTag = await get(
			db,
			`/xrpc/radio.4000.listTracks?tags=dub&limit=1&cursor=${encodeURIComponent(byTag.body.cursor ?? '')}`
		)
		expect(nextByTag.body.tracks.map((t) => t.record.title)).toEqual(['Basic Channel'])
	})

	test('getRadios, listBroadcasts and chat.listMessages', async () => {
		const db = await seeded()
		expect(
			(
				await get(db, '/xrpc/radio.4000.getRadios?dids=did:plc:bob&dids=did:plc:alice')
			).body.radios.map((r) => r.handle)
		).toEqual(['bob.test', 'alice.test'])
		expect(
			(await get(db, '/xrpc/radio.4000.listBroadcasts')).body.broadcasts.map((b) => b.author.handle)
		).toEqual(['bob.test'])
		const chat = await get(db, '/xrpc/radio.4000.chat.listMessages?radio=did:plc:alice')
		expect(chat.body.messages.map((m) => [m.author.handle, m.record.text])).toEqual([
			['bob.test', 'nice']
		])
	})

	test('answers match their lexicons', async () => {
		const db = await seeded()
		for (const [nsid, query] of [
			['radio.4000.listRadios', ''],
			['radio.4000.getRadios', 'dids=did:plc:alice'],
			['radio.4000.listTracks', ''],
			['radio.4000.listBroadcasts', ''],
			['radio.4000.chat.listMessages', 'radio=did:plc:alice']
		] as const) {
			const {body} = await get(db, `/xrpc/${nsid}?${query}`)
			expect(() =>
				lexicons.assertValidXrpcOutput(nsid, JSON.parse(JSON.stringify(body)))
			).not.toThrow()
		}
	})

	test('bad parameters and unknown methods are refused', async () => {
		const db = await seeded()
		expect((await get(db, '/xrpc/radio.4000.listTracks?limit=1000')).status).toBe(400)
		expect((await get(db, '/xrpc/radio.4000.chat.listMessages')).status).toBe(400)
		expect((await get(db, '/xrpc/app.bsky.feed.getTimeline')).status).toBe(501)
	})
})
