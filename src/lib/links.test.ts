import {expect, test} from 'vitest'
import {channelHref, channelTracksHref, isAppPath, trackHref} from './links'

test('a radio and its filters live at /@handle', () => {
	expect(channelHref('alice.test')).toBe('/@alice.test')
	expect(channelTracksHref('alice.test')).toBe('/@alice.test')
	expect(channelTracksHref('alice.test', {tags: 'dub,jazz'})).toBe('/@alice.test?tags=dub%2Cjazz')
})

test('a track lives under its radio', () => {
	expect(trackHref({id: 'at://did:plc:x/radio.4000.track/3kabc', slug: 'alice.test'})).toBe(
		'/@alice.test/tracks/3kabc'
	)
})

test('isAppPath accepts app paths only', () => {
	expect(isAppPath('/@alice.test?tags=dub')).toBe(true)
	expect(isAppPath('//evil.test')).toBe(false)
	expect(isAppPath('/\\evil.test')).toBe(false)
	expect(isAppPath('https://evil.test')).toBe(false)
	expect(isAppPath(null)).toBe(false)
})
