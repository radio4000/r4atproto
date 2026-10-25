import {describe, expect, test} from 'vitest'
import {channelFromView, trackFromView} from './index-views'

const author = {did: 'did:plc:alice', handle: 'alice.test'}

describe('index views', () => {
	test('a radio view maps like a record, with the image URL and counts it carries', () => {
		const channel = channelFromView({
			...author,
			record: {name: 'Radio Alice', createdAt: '2026-01-01T00:00:00.000Z'},
			image: 'https://pds.test/xrpc/com.atproto.sync.getBlob?did=x&cid=y',
			trackCount: 12,
			latestTrackAt: '2026-02-01T00:00:00.000Z',
			indexedAt: '2026-02-01T00:00:00.000Z'
		})
		expect(channel).toMatchObject({
			id: author.did,
			slug: 'alice.test',
			name: 'Radio Alice',
			image: 'https://pds.test/xrpc/com.atproto.sync.getBlob?did=x&cid=y',
			track_count: 12,
			has_record: true
		})
	})

	test('without a channel record, the Bluesky profile names the radio', () => {
		const view = {...author, trackCount: 1, indexedAt: '2026-01-01T00:00:00.000Z'}
		const channel = channelFromView(view, {
			...author,
			displayName: 'Alice',
			avatar: 'https://cdn.test/a.jpg'
		})
		expect(channel).toMatchObject({
			name: 'Alice',
			image: 'https://cdn.test/a.jpg',
			has_record: false
		})
	})

	test('records that fail our lexicons are dropped, as from any repo', () => {
		const view = {uri: 'at://did:plc:alice/radio.4000.track/1', cid: 'c', author, indexedAt: ''}
		expect(trackFromView({...view, record: {title: 5}})).toBeNull()
		expect(
			trackFromView({
				...view,
				record: {url: 'https://youtu.be/x', title: 'A', createdAt: '2026-01-01T00:00:00.000Z'}
			})
		).toMatchObject({title: 'A', slug: 'alice.test'})
	})
})
