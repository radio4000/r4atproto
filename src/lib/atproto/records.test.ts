import {describe, expect, test} from 'vitest'
import {channelFrom, channelToRecord, followRkey, trackFromRecord, trackToRecord} from './records'

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
	)

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
