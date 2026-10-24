import {describe, it, expect} from 'vitest'
import {fetchRadio4000Tracks} from './sync.service'

describe('sync.service Radio4000 integration', () => {
	const API_ENDPOINT = 'https://oupgudlkspsmzkmeovlh.supabase.co'
	const API_KEY =
		'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im91cGd1ZGxrc3BzbXprbWVvdmxoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTM0NTIwNzQsImV4cCI6MjAyOTAyODA3NH0.KAbKFBChJHtxTmOZM2pdeppIyNbcnQkEgSi6RA7OQdo'

	it('should fetch ko002 tracks and check for timestamp uniqueness', async () => {
		const tracks = await fetchRadio4000Tracks(API_ENDPOINT, API_KEY, 'ko002')

		console.log(`\nFetched ${tracks.length} tracks from ko002`)

		// Check first 10 tracks for timestamp patterns
		const sample = tracks.slice(0, Math.min(10, tracks.length))
		console.log('\nFirst 10 tracks with field names:')
		sample.forEach((track, i) => {
			console.log(`${i}. ${track.title}`)
			console.log(`   created_at: ${track.created_at}`)
			console.log(`   updated_at: ${track.updated_at}`)
			console.log(`   url: ${track.url}`)
			console.log(`   description: ${track.description || '(none)'}`)
			console.log(`   discogs_url: ${track.discogs_url || '(none)'}`)
			if (i === 0) {
				console.log('   All fields:', Object.keys(track).join(', '))
			}
			console.log('')
		})

		// Check for duplicate timestamps
		const timestamps = tracks.map((t) => t.created_at)
		const uniqueTimestamps = new Set(timestamps)
		const duplicateCount = timestamps.length - uniqueTimestamps.size

		console.log(`\nTotal tracks: ${tracks.length}`)
		console.log(`Unique timestamps: ${uniqueTimestamps.size}`)
		console.log(`Duplicate timestamps: ${duplicateCount}`)

		if (duplicateCount > 0) {
			// Find which timestamps are duplicated
			const timestampCounts = new Map<string, number>()
			timestamps.forEach((ts) => {
				timestampCounts.set(ts, (timestampCounts.get(ts) || 0) + 1)
			})

			const duplicates = Array.from(timestampCounts.entries())
				.filter(([_, count]) => count > 1)
				.sort((a, b) => b[1] - a[1])
				.slice(0, 5) // Show top 5

			console.log('\nTop timestamp collisions:')
			duplicates.forEach(([ts, count]) => {
				console.log(`  ${ts}: ${count} tracks`)
			})
		}

		// Generate rkeys as the import would
		const rkeysWithSequence = tracks.map((track, index) => {
			const timestamp = new Date(track.created_at).getTime()
			const globalIndex = index
			return {
				rkey: `${timestamp.toString().padStart(13, '0')}-${globalIndex.toString().padStart(5, '0')}`,
				timestamp: timestamp,
				date: track.created_at,
				title: track.title
			}
		})

		// Check that rkeys are unique
		const rkeys = rkeysWithSequence.map((r) => r.rkey)
		const uniqueRkeys = new Set(rkeys)
		expect(uniqueRkeys.size).toBe(rkeys.length) // All rkeys should be unique

		// Check that rkeys sort correctly (newest first)
		const sortedRkeys = [...rkeysWithSequence].sort((a, b) => b.rkey.localeCompare(a.rkey))
		console.log('\nFirst 5 tracks when sorted by rkey descending (reverse: true):')
		sortedRkeys.slice(0, 5).forEach((r) => {
			console.log(`  ${r.date} - ${r.title}`)
		})

		console.log('\nLast 5 tracks when sorted by rkey descending:')
		sortedRkeys.slice(-5).forEach((r) => {
			console.log(`  ${r.date} - ${r.title}`)
		})

		// The first track should be the newest
		expect(sortedRkeys[0].timestamp).toBeGreaterThanOrEqual(
			sortedRkeys[sortedRkeys.length - 1].timestamp
		)
	}, 30000) // 30 second timeout for API call
})
