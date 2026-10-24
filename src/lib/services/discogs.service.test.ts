import {describe, it, expect} from 'vitest'
import {
	parseDiscogsUrl,
	extractSuggestions,
	resourceTrackToR4Track,
	buildApiUrl,
	type DiscogsResource,
	type DiscogsTrack
} from './discogs.service'

describe('Discogs Service', () => {
	describe('parseDiscogsUrl', () => {
		it('should parse release URLs', () => {
			const urls = [
				'https://www.discogs.com/release/123456',
				'https://www.discogs.com/release/123456-Artist-Album',
				'https://discogs.com/Artist-Album/release/789012-Artist-Album'
			]

			for (const url of urls) {
				const result = parseDiscogsUrl(url)
				expect(result).not.toBeNull()
				expect(result?.type).toBe('release')
				expect(result?.id).toMatch(/^\d+$/)
			}
		})

		it('should parse master URLs', () => {
			const urls = [
				'https://www.discogs.com/master/456789',
				'https://www.discogs.com/master/456789-Artist-Album',
				'https://discogs.com/Artist-Album/master/111222-Artist-Album'
			]

			for (const url of urls) {
				const result = parseDiscogsUrl(url)
				expect(result).not.toBeNull()
				expect(result?.type).toBe('master')
				expect(result?.id).toMatch(/^\d+$/)
			}
		})

		it('should extract ID from hyphenated URLs', () => {
			const result = parseDiscogsUrl('https://www.discogs.com/release/123456-Some-Artist-Name')
			expect(result).not.toBeNull()
			expect(result?.id).toBe('123456')
		})

		it('should return null for invalid URLs', () => {
			const invalidUrls = [
				'https://example.com/release/123',
				'https://www.discogs.com/invalid/123',
				'not-a-url',
				'https://www.discogs.com',
				'https://www.discogs.com/artist/123' // artist URLs not supported
			]

			for (const url of invalidUrls) {
				expect(parseDiscogsUrl(url)).toBeNull()
			}
		})

		it('should return null for malformed URLs', () => {
			expect(parseDiscogsUrl('not a url')).toBeNull()
			expect(parseDiscogsUrl('')).toBeNull()
		})
	})

	describe('extractSuggestions', () => {
		it('should extract tags from genres, styles, year, and labels', () => {
			const resource: DiscogsResource = {
				id: 123,
				title: 'Test Album',
				uri: 'https://discogs.com/release/123',
				year: 2020,
				genres: ['Electronic', 'Hip Hop'],
				styles: ['Techno', 'Boom Bap'],
				labels: [{name: 'Test Label'}, {name: 'Another Label'}]
			}

			const suggestions = extractSuggestions(resource)

			expect(suggestions).toContain('electronic')
			expect(suggestions).toContain('hip-hop')
			expect(suggestions).toContain('techno')
			expect(suggestions).toContain('boom-bap')
			expect(suggestions).toContain('2020')
			expect(suggestions).toContain('test-label')
			expect(suggestions).toContain('another-label')
		})

		it('should handle missing fields', () => {
			const resource: DiscogsResource = {
				id: 456,
				title: 'Minimal Album',
				uri: 'https://discogs.com/release/456'
			}

			const suggestions = extractSuggestions(resource)

			expect(suggestions).toEqual([])
		})

		it('should replace spaces with hyphens', () => {
			const resource: DiscogsResource = {
				id: 789,
				title: 'Test',
				uri: 'https://discogs.com/release/789',
				genres: ['Progressive Rock'],
				styles: ['Art Rock']
			}

			const suggestions = extractSuggestions(resource)

			expect(suggestions).toContain('progressive-rock')
			expect(suggestions).toContain('art-rock')
		})

		it('should convert to lowercase', () => {
			const resource: DiscogsResource = {
				id: 999,
				title: 'Test',
				uri: 'https://discogs.com/release/999',
				genres: ['LOUD GENRE']
			}

			const suggestions = extractSuggestions(resource)

			expect(suggestions).toContain('loud-genre')
		})

		it('should filter out falsy values', () => {
			const resource: DiscogsResource = {
				id: 111,
				title: 'Test',
				uri: 'https://discogs.com/release/111',
				year: 0, // falsy year
				genres: [],
				styles: [],
				labels: []
			}

			const suggestions = extractSuggestions(resource)

			expect(suggestions).toEqual([])
		})
	})

	describe('resourceTrackToR4Track', () => {
		it('should convert track with matching video', () => {
			const track: DiscogsTrack = {
				title: 'Test Track',
				position: 'A1',
				duration: '3:45'
			}

			const resource: DiscogsResource = {
				id: 123,
				title: 'Test Album',
				uri: 'https://discogs.com/release/123',
				artists_sort: 'Test Artist',
				videos: [
					{
						uri: 'https://youtube.com/watch?v=xxx',
						title: 'Some Other Track'
					},
					{
						uri: 'https://youtube.com/watch?v=abc',
						title: 'Test Track - Official Video'
					}
				]
			}

			const r4Track = resourceTrackToR4Track(track, resource)

			expect(r4Track).toEqual({
				title: 'Test Artist - A1. Test Track',
				url: 'https://youtube.com/watch?v=abc',
				discogs_url: 'https://discogs.com/release/123',
				description: '3:45',
				source_track_uri: undefined
			})
		})

		it('should handle track with no matching video', () => {
			const track: DiscogsTrack = {
				title: 'Track Without Video',
				position: 'B1',
				duration: '4:20'
			}

			const resource: DiscogsResource = {
				id: 456,
				title: 'Test Album',
				uri: 'https://discogs.com/release/456',
				artists_sort: 'Another Artist',
				videos: [
					{
						uri: 'https://youtube.com/watch?v=yyy',
						title: 'Different Track'
					}
				]
			}

			const r4Track = resourceTrackToR4Track(track, resource)

			expect(r4Track).toEqual({
				title: 'Another Artist - B1. Track Without Video',
				url: '', // no matching video
				discogs_url: 'https://discogs.com/release/456',
				description: '4:20',
				source_track_uri: undefined
			})
		})

		it('should handle resource with no videos', () => {
			const track: DiscogsTrack = {
				title: 'Track',
				position: 'A1'
			}

			const resource: DiscogsResource = {
				id: 789,
				title: 'Album',
				uri: 'https://discogs.com/release/789',
				videos: []
			}

			const r4Track = resourceTrackToR4Track(track, resource)

			expect(r4Track.url).toBe('')
			expect(r4Track.description).toBe('No media available')
		})

		it('should handle track with no duration', () => {
			const track: DiscogsTrack = {
				title: 'Track',
				position: 'A1'
			}

			const resource: DiscogsResource = {
				id: 111,
				title: 'Album',
				uri: 'https://discogs.com/release/111'
			}

			const r4Track = resourceTrackToR4Track(track, resource)

			// No duration and no video = "No media available"
			expect(r4Track.description).toBe('No media available')
		})

		it('should match videos case-insensitively', () => {
			const track: DiscogsTrack = {
				title: 'UPPERCASE TRACK',
				position: 'A1'
			}

			const resource: DiscogsResource = {
				id: 222,
				title: 'Album',
				uri: 'https://discogs.com/release/222',
				videos: [
					{
						uri: 'https://youtube.com/watch?v=zzz',
						title: 'uppercase track - video'
					}
				]
			}

			const r4Track = resourceTrackToR4Track(track, resource)

			expect(r4Track.url).toBe('https://youtube.com/watch?v=zzz')
		})

		it('should include source track URI when provided', () => {
			const track: DiscogsTrack = {
				title: 'Test Track',
				position: 'A1'
			}

			const resource: DiscogsResource = {
				id: 999,
				title: 'Test Album',
				uri: 'https://discogs.com/release/999'
			}

			const sourceTrackUri = 'at://did:plc:abc123/com.radio4000.track/xyz789'
			const r4Track = resourceTrackToR4Track(track, resource, sourceTrackUri)

			expect(r4Track.source_track_uri).toBe(sourceTrackUri)
		})
	})

	describe('buildApiUrl', () => {
		it('should build release API URL', () => {
			const url = buildApiUrl({id: '123456', type: 'release'})
			expect(url).toBe('https://api.discogs.com/releases/123456')
		})

		it('should build master API URL', () => {
			const url = buildApiUrl({id: '789012', type: 'master'})
			expect(url).toBe('https://api.discogs.com/masters/789012')
		})

		it('should handle IDs with special characters', () => {
			const url = buildApiUrl({id: '123-456', type: 'release'})
			expect(url).toBe('https://api.discogs.com/releases/123-456')
		})
	})
})
