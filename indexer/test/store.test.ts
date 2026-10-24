// @vitest-environment node
import {describe, expect, test} from 'vitest'
import {applyChanges, removeAccount, updateHandle, type Change} from '../src/store'
import {testDb} from './sqlite-db'

const alice = {did: 'did:plc:alice', handle: 'alice.test', pds: 'https://pds.test'}
const ids = new Map([[alice.did, alice]])
const track = (rkey: string, description = '', createdAt = '2026-01-01T00:00:00.000Z'): Change => ({
	action: 'upsert',
	collection: 'radio.4000.track',
	did: alice.did,
	rkey,
	cid: 'bafy' + rkey,
	record: {url: 'https://youtu.be/x', title: `Track ${rkey}`, description, createdAt}
})

describe('applyChanges', () => {
	test('a track makes its radio, with tags, mentions and counts', async () => {
		const db = testDb()
		await applyChanges(
			db,
			[track('1', 'Deep #Dub by @bob.test', '2026-01-02T00:00:00.000Z'), track('2')],
			ids
		)
		const radio = db.sqlite.prepare('SELECT handle, track_count, latest_track_at FROM radios').get()
		expect(radio).toEqual({
			handle: 'alice.test',
			track_count: 2,
			latest_track_at: '2026-01-02T00:00:00.000Z'
		})
		expect(db.sqlite.prepare('SELECT tag FROM track_tags').all()).toEqual([{tag: 'dub'}])
		expect(db.sqlite.prepare('SELECT handle FROM track_mentions').all()).toEqual([
			{handle: 'bob.test'}
		])
		const found = db.sqlite
			.prepare("SELECT title FROM tracks_fts WHERE tracks_fts MATCH 'deep'")
			.all()
		expect(found).toEqual([{title: 'Track 1'}])
	})

	test('an edit replaces tags and search text; a delete removes the track', async () => {
		const db = testDb()
		await applyChanges(db, [track('1', '#dub')], ids)
		await applyChanges(db, [track('1', '#jazz')], ids)
		expect(db.sqlite.prepare('SELECT tag FROM track_tags').all()).toEqual([{tag: 'jazz'}])
		await applyChanges(
			db,
			[{action: 'delete', collection: 'radio.4000.track', did: alice.did, rkey: '1'}],
			ids
		)
		expect(db.sqlite.prepare('SELECT count(*) AS n FROM tracks').get()).toEqual({n: 0})
		expect(db.sqlite.prepare('SELECT count(*) AS n FROM track_tags').get()).toEqual({n: 0})
		expect(
			db.sqlite.prepare("SELECT count(*) AS n FROM tracks_fts WHERE tracks_fts MATCH 'jazz'").get()
		).toEqual({n: 0})
		expect(db.sqlite.prepare('SELECT track_count FROM radios').get()).toEqual({track_count: 0})
	})

	test('a channel record fills the radio and its location', async () => {
		const db = testDb()
		const record = {
			name: 'Radio Alice',
			geo: {latitude: '52.5', longitude: '13.4'},
			createdAt: '2025-01-01T00:00:00.000Z'
		}
		await applyChanges(
			db,
			[
				{
					action: 'upsert',
					collection: 'radio.4000.channel',
					did: alice.did,
					rkey: 'self',
					cid: 'c',
					record
				}
			],
			ids
		)
		expect(db.sqlite.prepare('SELECT name, latitude, longitude FROM radios').get()).toEqual({
			name: 'Radio Alice',
			latitude: 52.5,
			longitude: 13.4
		})
		expect(
			db.sqlite.prepare("SELECT handle FROM radios_fts WHERE radios_fts MATCH 'alice'").all()
		).toEqual([{handle: 'alice.test'}])
	})

	test('chat messages index their author, not a radio', async () => {
		const db = testDb()
		const record = {subject: 'did:plc:bob', text: 'hi', createdAt: '2026-01-01T00:00:00.000Z'}
		await applyChanges(
			db,
			[
				{
					action: 'upsert',
					collection: 'radio.4000.chat.message',
					did: alice.did,
					rkey: '3k',
					cid: 'c',
					record
				}
			],
			ids
		)
		expect(db.sqlite.prepare('SELECT subject FROM chat_messages').all()).toEqual([
			{subject: 'did:plc:bob'}
		])
		expect(db.sqlite.prepare('SELECT count(*) AS n FROM radios').get()).toEqual({n: 0})
		expect(db.sqlite.prepare('SELECT handle FROM accounts').get()).toEqual({handle: 'alice.test'})
	})

	test('a handle change and an account removal reach every table', async () => {
		const db = testDb()
		await applyChanges(db, [track('1', '#dub')], ids)
		await updateHandle(db, alice.did, 'alice.new')
		expect(
			db.sqlite.prepare("SELECT handle FROM radios_fts WHERE radios_fts MATCH 'new'").all()
		).toEqual([{handle: 'alice.new'}])
		await removeAccount(db, alice.did)
		for (const table of ['accounts', 'radios', 'tracks', 'track_tags']) {
			expect(db.sqlite.prepare(`SELECT count(*) AS n FROM ${table}`).get()).toEqual({n: 0})
		}
	})
})
