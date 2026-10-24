import {describe, it, expect} from 'vitest'
import {parseTrackUrl, extractFirstTrackUrl, buildEmbedUrl} from './url-patterns'

describe('url-patterns', () => {
	describe('parseTrackUrl', () => {
		it('parses youtube watch', () => {
			const r = parseTrackUrl('https://www.youtube.com/watch?v=abc123')
			expect(r).toEqual({
				provider: 'youtube',
				id: 'abc123',
				url: 'https://www.youtube.com/watch?v=abc123'
			})
		})

		it('parses youtu.be', () => {
			const r = parseTrackUrl('https://youtu.be/xyz789')
			expect(r).toEqual({
				provider: 'youtube',
				id: 'xyz789',
				url: 'https://www.youtube.com/watch?v=xyz789'
			})
		})

		it('parses soundcloud', () => {
			const r = parseTrackUrl('https://soundcloud.com/artist/track-name')
			expect(r).toEqual({
				provider: 'soundcloud',
				id: 'artist/track-name',
				url: 'https://soundcloud.com/artist/track-name'
			})
		})

		it('parses vimeo', () => {
			const r = parseTrackUrl('https://vimeo.com/123456')
			expect(r).toEqual({provider: 'vimeo', id: '123456', url: 'https://vimeo.com/123456'})
		})

		it('parses bandcamp', () => {
			const r = parseTrackUrl('https://mylabel.bandcamp.com/track/cool-song')
			expect(r).toEqual({
				provider: 'bandcamp',
				id: 'mylabel/track/cool-song',
				url: 'https://mylabel.bandcamp.com/track/cool-song'
			})
		})

		it('parses direct file', () => {
			const r = parseTrackUrl('https://example.com/media/song.mp3')
			expect(r).toEqual({
				provider: 'file',
				id: 'https://example.com/media/song.mp3',
				url: 'https://example.com/media/song.mp3'
			})
		})

		it('returns null for unsupported', () => {
			expect(parseTrackUrl('https://example.com/page')).toBeNull()
		})

		it('handles edge cases for youtube', () => {
			const r = parseTrackUrl('https://www.youtube.com/watch?v=abc123&t=30s')
			expect(r).toEqual({
				provider: 'youtube',
				id: 'abc123',
				url: 'https://www.youtube.com/watch?v=abc123'
			})
		})

		it('handles invalid URLs', () => {
			expect(parseTrackUrl('not-a-url')).toBeNull()
			expect(parseTrackUrl('')).toBeNull()
		})
	})

	describe('extractFirstTrackUrl', () => {
		it('extracts first url in text', () => {
			const r = extractFirstTrackUrl('Check this https://youtu.be/xyz789 wow')
			expect(r).toEqual({
				provider: 'youtube',
				id: 'xyz789',
				url: 'https://www.youtube.com/watch?v=xyz789'
			})
		})

		it('returns null when no track url in text', () => {
			const r = extractFirstTrackUrl('Just some text without a link')
			expect(r).toBeNull()
		})

		it('extracts from multiple URLs', () => {
			const r = extractFirstTrackUrl(
				'Check https://youtu.be/abc123 and https://soundcloud.com/artist/track'
			)
			expect(r).toEqual({
				provider: 'youtube',
				id: 'abc123',
				url: 'https://www.youtube.com/watch?v=abc123'
			})
		})

		it('handles empty text', () => {
			const r = extractFirstTrackUrl('')
			expect(r).toBeNull()
		})
	})

	describe('buildEmbedUrl', () => {
		it('builds YouTube embed URL with autoplay', () => {
			const url = buildEmbedUrl(
				{provider: 'youtube', id: 'abc123', url: 'https://www.youtube.com/watch?v=abc123'},
				{autoplay: true}
			)
			expect(url).toContain('youtube.com/embed/abc123')
			expect(url).toContain('autoplay=1')
		})

		it('builds YouTube embed URL without autoplay', () => {
			const url = buildEmbedUrl(
				{provider: 'youtube', id: 'abc123', url: 'https://www.youtube.com/watch?v=abc123'},
				{autoplay: false}
			)
			expect(url).toContain('youtube.com/embed/abc123')
			expect(url).toContain('autoplay=0')
		})

		it('builds Vimeo embed URL', () => {
			const url = buildEmbedUrl(
				{provider: 'vimeo', id: '123456', url: 'https://vimeo.com/123456'},
				{autoplay: true}
			)
			expect(url).toContain('player.vimeo.com/video/123456')
			expect(url).toContain('autoplay=1')
		})

		it('builds SoundCloud embed URL', () => {
			const url = buildEmbedUrl(
				{provider: 'soundcloud', id: 'artist/track', url: 'https://soundcloud.com/artist/track'},
				{autoplay: true}
			)
			expect(url).toContain('w.soundcloud.com/player')
			expect(url).toContain('auto_play=true')
		})

		it('returns null for unsupported providers', () => {
			const url = buildEmbedUrl({
				provider: 'file',
				id: 'https://example.com/song.mp3',
				url: 'https://example.com/song.mp3'
			})
			expect(url).toBeNull()
		})

		it('returns null for null input', () => {
			const url = buildEmbedUrl(null)
			expect(url).toBeNull()
		})
	})
})
