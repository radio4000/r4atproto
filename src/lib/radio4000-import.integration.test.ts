import {describe, expect, it} from 'vitest'
import {fetchRadio4000Tracks, tidFromDate} from './radio4000-import'

// Hits the live radio4000.com API.
describe('radio4000.com import', () => {
	it('fetches a channel and gives every track a unique TID', async () => {
		const tracks = await fetchRadio4000Tracks('ko002')
		expect(tracks.length).toBeGreaterThan(0)
		const tids = new Set(tracks.map((t) => tidFromDate(t.created_at)))
		expect(tids.size).toBe(tracks.length)
	})
})
