import {expect, test} from 'vitest'
import {channelHref, channelTracksHref, trackHref} from './links'

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
