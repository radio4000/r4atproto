// @vitest-environment node
import {describe, expect, test, vi} from 'vitest'
import {changeOf, processEvents, type JetstreamEvent} from '../src/events'
import {testDb} from './sqlite-db'

const alice = {did: 'did:plc:alice', handle: 'alice.test', pds: 'https://pds.test'}
const cid = 'bafyreie5737gdxlw5i64vzichcalba3z2v5n6icifvx5xytvske7mr3hpm'
const commit = (
	operation: 'create' | 'update' | 'delete',
	collection: string,
	rkey: string,
	record?: object
): JetstreamEvent => ({
	did: alice.did,
	time_us: 1,
	kind: 'commit',
	commit: {operation, collection, rkey, cid, record: record as never}
})
const track = {url: 'https://youtu.be/x', title: 'Dub', createdAt: '2026-01-01T00:00:00.000Z'}

describe('changeOf', () => {
	test('keeps our valid records and deletes, drops the rest', () => {
		expect(changeOf(commit('create', 'radio.4000.track', '1', track))).toMatchObject({
			action: 'upsert'
		})
		expect(changeOf(commit('delete', 'radio.4000.track', '1'))).toMatchObject({action: 'delete'})
		expect(changeOf(commit('create', 'radio.4000.track', '1', {title: 5}))).toBeNull()
		expect(changeOf(commit('create', 'app.bsky.feed.post', '1', {text: 'hi'}))).toBeNull()
		expect(
			changeOf(
				commit('create', 'radio.4000.follow', '1', {
					subject: 'did:plc:x',
					createdAt: track.createdAt
				})
			)
		).toBeNull()
	})
})

describe('processEvents', () => {
	test('a new account is resolved, backfilled, and its record indexed', async () => {
		const db = testDb()
		const deps = {resolve: vi.fn(async () => alice), backfill: vi.fn(async () => {})}
		await processEvents(db, [commit('create', 'radio.4000.track', '1', track)], deps)
		expect(deps.backfill).toHaveBeenCalledWith(alice.did)
		await processEvents(db, [commit('create', 'radio.4000.track', '2', track)], deps)
		expect(deps.resolve).toHaveBeenCalledTimes(1)
		expect(db.sqlite.prepare('SELECT track_count FROM radios').get()).toEqual({track_count: 2})
	})

	test('handle changes and deactivations of known accounts apply; others are ignored', async () => {
		const db = testDb()
		const deps = {resolve: vi.fn(async () => alice), backfill: vi.fn(async () => {})}
		await processEvents(db, [commit('create', 'radio.4000.track', '1', track)], deps)
		deps.resolve.mockResolvedValue({...alice, handle: 'alice.new'})
		await processEvents(db, [{did: alice.did, time_us: 2, kind: 'identity'}], deps)
		expect(db.sqlite.prepare('SELECT handle FROM radios').get()).toEqual({handle: 'alice.new'})
		await processEvents(
			db,
			[{did: 'did:plc:stranger', time_us: 3, kind: 'account', account: {active: false}}],
			deps
		)
		expect(db.sqlite.prepare('SELECT count(*) AS n FROM radios').get()).toEqual({n: 1})
		await processEvents(
			db,
			[{did: alice.did, time_us: 4, kind: 'account', account: {active: false}}],
			deps
		)
		expect(db.sqlite.prepare('SELECT count(*) AS n FROM tracks').get()).toEqual({n: 0})
	})

	test('an unresolvable account is skipped without failing the batch', async () => {
		const db = testDb()
		const deps = {
			resolve: vi.fn(async () => Promise.reject(new Error('gone'))),
			backfill: vi.fn(async () => {})
		}
		await expect(
			processEvents(db, [commit('create', 'radio.4000.track', '1', track)], deps)
		).resolves.toBeUndefined()
		expect(db.sqlite.prepare('SELECT count(*) AS n FROM tracks').get()).toEqual({n: 0})
	})
})
