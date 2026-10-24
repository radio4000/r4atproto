import {describe, expect, it} from 'vitest'
import app from '../../config/app.json' with {type: 'json'}
import {fetchRadio4000Tracks, tidFromDate} from './sync.service'

// Hits the live radio4000.com API.
describe('radio4000.com import', () => {
	it('fetches a channel and gives every track a unique TID', async () => {
		const {apiEndpoint, apiKey} = app.radio4000
		const tracks = await fetchRadio4000Tracks(apiEndpoint, apiKey, 'ko002')
		expect(tracks.length).toBeGreaterThan(0)
		const tids = new Set(tracks.map((t) => tidFromDate(t.created_at)))
		expect(tids.size).toBe(tracks.length)
	})
})
