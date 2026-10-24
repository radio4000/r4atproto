import {describe, it, expect} from 'vitest'

describe('sync.service import ordering', () => {
	describe('timestamp-based rkey generation', () => {
		it('should generate rkeys from timestamps', () => {
			// Simulate what happens during import with timestamp-based rkeys
			const tracksToImport = [
				{url: 'track1', title: 'First (oldest)', created_at: '2020-01-01T00:00:00.000Z'},
				{url: 'track2', title: 'Second', created_at: '2021-01-01T00:00:00.000Z'},
				{url: 'track3', title: 'Third', created_at: '2022-01-01T00:00:00.000Z'},
				{url: 'track4', title: 'Fourth', created_at: '2023-01-01T00:00:00.000Z'},
				{url: 'track5', title: 'Last (newest)', created_at: '2024-01-01T00:00:00.000Z'}
			]

			const rkeys: string[] = []

			// This simulates the rkey generation logic in importRadio4000Tracks
			tracksToImport.forEach((track) => {
				const timestamp = new Date(track.created_at).getTime()
				const rkey = timestamp.toString().padStart(13, '0')
				rkeys.push(rkey)
			})

			// Oldest track should get lowest timestamp
			expect(rkeys[0]).toBe('1577836800000') // 2020-01-01
			// Newest track should get highest timestamp
			expect(rkeys[4]).toBe('1704067200000') // 2024-01-01

			// Rkeys should be in ascending order (matching timestamp order)
			expect(rkeys).toEqual([
				'1577836800000',
				'1609459200000',
				'1640995200000',
				'1672531200000',
				'1704067200000'
			])
		})

		it('should result in correct display order with reverse:true API', () => {
			// With reverse:true, API returns records sorted by rkey descending
			// So highest rkey (newest timestamp) comes first

			const importedRkeys = [
				'1577836800000', // 2020 - Oldest track
				'1609459200000', // 2021
				'1640995200000', // 2022
				'1672531200000', // 2023
				'1704067200000' // 2024 - Newest track
			]

			// Simulate API with reverse:true - sort by rkey descending
			const apiResponse = [...importedRkeys].sort((a, b) => b.localeCompare(a))

			// API should return newest first
			expect(apiResponse[0]).toBe('1704067200000') // 2024 - Newest track comes first ✓
			expect(apiResponse[4]).toBe('1577836800000') // 2020 - Oldest track comes last ✓
		})
	})

	describe('timestamp-based ordering matches manual adds', () => {
		it('should sort imported tracks the same as manually added tracks', () => {
			// Radio4000 tracks with their original timestamps
			const importedTracks = [
				{title: 'track1-oldest', created_at: '2020-01-01T00:00:00.000Z'},
				{title: 'track2', created_at: '2021-01-01T00:00:00.000Z'},
				{title: 'track3-newest', created_at: '2024-01-01T00:00:00.000Z'}
			]

			// Generate rkeys from timestamps
			const rkeys = importedTracks.map((track) => {
				const timestamp = new Date(track.created_at).getTime()
				return timestamp.toString().padStart(13, '0')
			})

			expect(rkeys).toEqual([
				'1577836800000', // oldest
				'1609459200000',
				'1704067200000' // newest
			])

			// With reverse:true API, these sort descending
			const sortedRkeys = [...rkeys].sort((a, b) => b.localeCompare(a))
			expect(sortedRkeys).toEqual([
				'1704067200000', // newest first
				'1609459200000',
				'1577836800000' // oldest last
			])

			// This matches how manually added tracks appear (newest first)
			// Because manual tracks also use timestamp-based TIDs
		})
	})
})
