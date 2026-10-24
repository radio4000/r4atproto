import {describe, expect, test} from 'vitest'
import {
	broadcastFromRecord,
	channelFrom,
	channelToRecord,
	followRkey,
	trackFromRecord,
	trackToRecord
} from './records'
import type {Track} from '#lib/types.js'

const owner = {did: 'did:plc:abc', handle: 'alice.test', pds: 'https://pds.test'}

describe('trackFromRecord', () => {
	const track = trackFromRecord(
		{
			uri: 'at://did:plc:abc/radio.4000.track/3kabc',
			cid: 'bafy',
			value: {
				url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
				title: 'Never',
				description: 'A classic #Pop by @rick.bsky.social',
				createdAt: '2026-01-01T00:00:00.000Z'
			}
		},
		owner
	) as Track

	test('keys the track by its URI and its radio by handle', () => {
		expect(track.id).toBe('at://did:plc:abc/radio.4000.track/3kabc')
		expect(track.slug).toBe('alice.test')
		expect(track.did).toBe('did:plc:abc')
	})

	test('derives tags, mentions and media from url and description', () => {
		expect(track.tags).toEqual(['pop'])
		expect(track.mentions).toEqual(['@rick.bsky.social'])
		expect(track.provider).toBe('youtube')
		expect(track.media_id).toBe('dQw4w9WgXcQ')
	})

	test('round-trips through a record', () => {
		const record = trackToRecord(track)
		expect(record).toMatchObject({
			$type: 'radio.4000.track',
			url: track.url,
			title: 'Never',
			createdAt: '2026-01-01T00:00:00.000Z'
		})
		expect(record).not.toHaveProperty('tags')
	})
})

describe('channelFrom', () => {
	test('falls back to the Bluesky profile without a channel record', () => {
		const channel = channelFrom(owner, null, {
			did: owner.did,
			handle: owner.handle,
			displayName: 'Alice',
			avatar: 'https://cdn.test/a.jpg'
		})
		expect(channel).toMatchObject({
			id: owner.did,
			slug: owner.handle,
			name: 'Alice',
			has_record: false
		})
		expect(channel.image).toBe('https://cdn.test/a.jpg')
	})

	test('prefers the record, and serves its image blob from the PDS', () => {
		const channel = channelFrom(owner, {
			name: 'Radio Alice',
			image: {ref: {$link: 'bafyimg'}},
			geo: {latitude: '52.52', longitude: '13.40'},
			createdAt: '2026-01-01T00:00:00.000Z'
		})
		expect(channel.name).toBe('Radio Alice')
		expect(channel.image).toBe(
			'https://pds.test/xrpc/com.atproto.sync.getBlob?did=did%3Aplc%3Aabc&cid=bafyimg'
		)
		expect([channel.latitude, channel.longitude]).toEqual([52.52, 13.4])
	})
})

describe('channel links', () => {
	test('come from links, or from the older single url', () => {
		const record = {
			links: [{url: 'https://a.test', title: 'A'}],
			createdAt: '2026-01-01T00:00:00.000Z'
		}
		expect(channelFrom(owner, record).links).toEqual([{url: 'https://a.test', title: 'A'}])
		expect(
			channelFrom(owner, {url: 'https://b.test', createdAt: '2026-01-01T00:00:00.000Z'}).links
		).toEqual([{url: 'https://b.test'}])
	})

	test('are saved as links, dropping the single url', () => {
		const record = channelToRecord(
			{links: [{url: 'https://a.test'}]},
			{url: 'https://old.test', createdAt: '2026-01-01T00:00:00.000Z'}
		)
		expect(record.links).toEqual([{url: 'https://a.test'}])
		expect(record.url).toBeUndefined()
	})
})

describe('channelToRecord', () => {
	test('stores coordinates as strings and keeps existing fields', () => {
		const record = channelToRecord(
			{latitude: 48.85, longitude: 2.35},
			{name: 'Kept', createdAt: '2025-01-01T00:00:00.000Z'}
		)
		expect(record).toMatchObject({
			$type: 'radio.4000.channel',
			name: 'Kept',
			geo: {latitude: '48.85', longitude: '2.35'},
			createdAt: '2025-01-01T00:00:00.000Z'
		})
	})
})

test('followRkey is a valid record key derived from the DID', () => {
	expect(followRkey('did:plc:ABC123')).toBe('did-plc-abc123')
})

describe('unsafe links in records', () => {
	const owner = {did: 'did:plc:x', handle: 'x.test', pds: 'https://pds.test'}

	test('a track whose link is not http(s) is dropped', () => {
		const record = {
			uri: 'at://did:plc:x/radio.4000.track/1',
			cid: 'c',
			value: {url: 'javascript:alert(1)', title: 'Evil', createdAt: '2026-01-01T00:00:00Z'}
		}
		expect(trackFromRecord(record, owner)).toBeNull()
	})

	test('channel links that are not http(s) are dropped', () => {
		const channel = channelFrom(owner, {
			name: 'X',
			links: [{url: 'javascript:alert(1)'}, {url: 'https://ok.test'}],
			createdAt: '2026-01-01T00:00:00Z'
		} as never)
		expect(channel.links).toEqual([{url: 'https://ok.test'}])
	})

	test('a broadcast opens a bounded number of decks', () => {
		const deck = {
			track: 'at://did:plc:x/radio.4000.track/1',
			url: 'https://youtu.be/x',
			positionMs: 0,
			positionAt: '2026-01-01T00:00:00Z',
			playing: true
		}
		const broadcast = broadcastFromRecord('did:plc:x', {
			decks: Array.from({length: 50}, () => deck),
			updatedAt: '2026-01-01T00:00:00Z'
		})
		expect(broadcast.decks.length).toBe(4)
	})
})
