import {describe, it, expect} from 'vitest'
import {
	normalizeTrack,
	normalizeTracks,
	isValidTrack,
	filterValidTracks,
	type RawTrack
} from './track-normalizer'

describe('Track Normalizer', () => {
	describe('normalizeTrack', () => {
		it('should normalize camelCase fields (legacy)', () => {
			const raw: RawTrack = {
				uri: 'at://did:plc:test/com.radio4000.track/123',
				cid: 'bafycid123',
				rkey: '123',
				url: 'https://youtube.com/watch?v=test',
				title: 'Test Track',
				description: 'Test description',
				discogsUrl: 'https://discogs.com/release/123',
				r4SupabaseId: 'supabase-123',
				createdAt: '2024-01-01T00:00:00Z',
				updatedAt: '2024-01-02T00:00:00Z',
				authorDid: 'did:plc:author'
			}

			const normalized = normalizeTrack(raw)

			// Output should be snake_case (canonical)
			expect(normalized).toEqual({
				uri: 'at://did:plc:test/com.radio4000.track/123',
				cid: 'bafycid123',
				rkey: '123',
				url: 'https://youtube.com/watch?v=test',
				title: 'Test Track',
				description: 'Test description',
				discogs_url: 'https://discogs.com/release/123',
				r4SupabaseId: 'supabase-123',
				created_at: '2024-01-01T00:00:00Z',
				updated_at: '2024-01-02T00:00:00Z',
				authorDid: 'did:plc:author'
			})
		})

		it('should normalize snake_case fields (canonical)', () => {
			const raw: RawTrack = {
				uri: 'at://did:plc:test/com.radio4000.track/456',
				url: 'https://soundcloud.com/test',
				title: 'Snake Case Track',
				discogs_url: 'https://discogs.com/release/456',
				r4_supabase_id: 'supabase-456',
				created_at: '2024-02-01T00:00:00Z',
				updated_at: '2024-02-02T00:00:00Z',
				author_did: 'did:plc:author2'
			}

			const normalized = normalizeTrack(raw)

			// Output should be snake_case (canonical)
			expect(normalized).toEqual({
				uri: 'at://did:plc:test/com.radio4000.track/456',
				cid: undefined,
				rkey: undefined,
				url: 'https://soundcloud.com/test',
				title: 'Snake Case Track',
				description: undefined,
				discogs_url: 'https://discogs.com/release/456',
				r4SupabaseId: 'supabase-456',
				created_at: '2024-02-01T00:00:00Z',
				updated_at: '2024-02-02T00:00:00Z',
				authorDid: 'did:plc:author2'
			})
		})

		it('should prefer camelCase when both are present', () => {
			const raw: RawTrack = {
				uri: 'at://test',
				url: 'https://test.com',
				title: 'Test',
				discogsUrl: 'https://discogs.com/release/camel',
				discogs_url: 'https://discogs.com/release/snake',
				createdAt: '2024-03-01T00:00:00Z',
				created_at: '2024-03-02T00:00:00Z'
			}

			const normalized = normalizeTrack(raw)

			// snake_case should take precedence (canonical format)
			expect(normalized.discogs_url).toBe('https://discogs.com/release/snake')
			expect(normalized.created_at).toBe('2024-03-02T00:00:00Z')
		})

		it('should handle missing optional fields', () => {
			const raw: RawTrack = {
				uri: 'at://test',
				url: 'https://test.com',
				title: 'Minimal Track'
			}

			const normalized = normalizeTrack(raw)

			expect(normalized).toEqual({
				uri: 'at://test',
				url: 'https://test.com',
				title: 'Minimal Track',
				cid: undefined,
				rkey: undefined,
				description: undefined,
				discogs_url: undefined,
				r4SupabaseId: undefined,
				created_at: undefined,
				updated_at: undefined,
				authorDid: undefined
			})
		})

		it('should handle empty strings', () => {
			const raw: RawTrack = {
				uri: '',
				url: '',
				title: ''
			}

			const normalized = normalizeTrack(raw)

			expect(normalized.uri).toBe('')
			expect(normalized.url).toBe('')
			expect(normalized.title).toBe('')
		})
	})

	describe('normalizeTracks', () => {
		it('should normalize array of tracks', () => {
			const raw: RawTrack[] = [
				{
					uri: 'at://test1',
					url: 'https://test1.com',
					title: 'Track 1',
					discogs_url: 'https://discogs.com/1'
				},
				{
					uri: 'at://test2',
					url: 'https://test2.com',
					title: 'Track 2',
					discogs_url: 'https://discogs.com/2'
				}
			]

			const normalized = normalizeTracks(raw)

			expect(normalized).toHaveLength(2)
			expect(normalized[0].discogs_url).toBe('https://discogs.com/1')
			expect(normalized[1].discogs_url).toBe('https://discogs.com/2')
		})

		it('should handle empty array', () => {
			expect(normalizeTracks([])).toEqual([])
		})
	})

	describe('isValidTrack', () => {
		it('should return true for valid tracks', () => {
			const track = {
				uri: 'at://test',
				url: 'https://test.com',
				title: 'Valid Track'
			}

			expect(isValidTrack(track)).toBe(true)
		})

		it('should return false for missing uri', () => {
			const track = {
				uri: '',
				url: 'https://test.com',
				title: 'No URI'
			}

			expect(isValidTrack(track)).toBe(false)
		})

		it('should return false for missing url', () => {
			const track = {
				uri: 'at://test',
				url: '',
				title: 'No URL'
			}

			expect(isValidTrack(track)).toBe(false)
		})

		it('should return false for missing title', () => {
			const track = {
				uri: 'at://test',
				url: 'https://test.com',
				title: ''
			}

			expect(isValidTrack(track)).toBe(false)
		})

		it('should return false for undefined required fields', () => {
			expect(isValidTrack({})).toBe(false)
			expect(isValidTrack({uri: 'at://test'})).toBe(false)
			expect(isValidTrack({url: 'https://test.com'})).toBe(false)
		})
	})

	describe('filterValidTracks', () => {
		it('should filter out invalid tracks', () => {
			const tracks = [
				{uri: 'at://test1', url: 'https://test1.com', title: 'Valid 1'},
				{uri: '', url: 'https://test2.com', title: 'Invalid - no URI'},
				{uri: 'at://test3', url: 'https://test3.com', title: 'Valid 2'},
				{uri: 'at://test4', url: '', title: 'Invalid - no URL'},
				{uri: 'at://test5', url: 'https://test5.com', title: ''}
			]

			const valid = filterValidTracks(tracks)

			expect(valid).toHaveLength(2)
			expect(valid[0].title).toBe('Valid 1')
			expect(valid[1].title).toBe('Valid 2')
		})

		it('should return empty array when all tracks are invalid', () => {
			const tracks = [
				{uri: '', url: '', title: ''},
				{url: 'https://test.com'},
				{title: 'No URI or URL'}
			]

			expect(filterValidTracks(tracks)).toEqual([])
		})

		it('should handle empty input', () => {
			expect(filterValidTracks([])).toEqual([])
		})
	})
})
