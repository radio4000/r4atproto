import {describe, it, expect} from 'vitest'
import {parseTrackUrl, extractFirstTrackUrl} from './url-patterns.js'

describe('url-patterns', () => {
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

	it('extracts first url in text', () => {
		const r = extractFirstTrackUrl('Check this https://youtu.be/xyz789 wow')
		expect(r).toEqual({
			provider: 'youtube',
			id: 'xyz789',
			url: 'https://www.youtube.com/watch?v=xyz789'
		})
	})
})
