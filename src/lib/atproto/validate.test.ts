import {describe, expect, test} from 'vitest'
import {safeUrl} from './validate'
import {isValidRecord} from './schemas'
import {BROADCAST, CHAT_MESSAGE, TRACK} from '#lib/lexicons.js'

describe('safeUrl', () => {
	test('keeps http(s) links', () => {
		expect(safeUrl('https://example.org/a?b=c')).toBe('https://example.org/a?b=c')
		expect(safeUrl('http://example.org')).toBe('http://example.org')
	})

	test('drops scripts, data and garbage', () => {
		expect(safeUrl('javascript:alert(1)')).toBeNull()
		expect(safeUrl('JavaScript:alert(1)')).toBeNull()
		expect(safeUrl('data:text/html,<script>alert(1)</script>')).toBeNull()
		expect(safeUrl('not a url')).toBeNull()
		expect(safeUrl(42)).toBeNull()
	})
})

describe('isValidRecord', () => {
	const now = new Date().toISOString()

	test('accepts records matching our lexicons', () => {
		expect(isValidRecord(TRACK, {url: 'https://youtu.be/x', title: 'A', createdAt: now})).toBe(true)
		expect(isValidRecord(CHAT_MESSAGE, {subject: 'did:plc:abc', text: 'hi', createdAt: now})).toBe(
			true
		)
	})

	test('rejects wrong types, missing fields and oversized values', () => {
		expect(isValidRecord(TRACK, {url: 'https://youtu.be/x', createdAt: now})).toBe(false)
		expect(isValidRecord(CHAT_MESSAGE, {subject: 'did:plc:abc', text: 5, createdAt: now})).toBe(
			false
		)
		expect(
			isValidRecord(CHAT_MESSAGE, {subject: 'did:plc:abc', text: 'x'.repeat(5000), createdAt: now})
		).toBe(false)
		expect(isValidRecord(BROADCAST, {decks: 'many', updatedAt: now})).toBe(false)
		const deck = {url: 'https://youtu.be/x', positionMs: 0, positionAt: now, playing: true}
		expect(isValidRecord(BROADCAST, {decks: [{...deck, track: 'not a uri'}], updatedAt: now})).toBe(
			false
		)
		const track = 'at://did:plc:abc/radio.4000.track/3kabc'
		expect(isValidRecord(BROADCAST, {decks: [{...deck, track}], updatedAt: now})).toBe(true)
		expect(isValidRecord(TRACK, null)).toBe(false)
	})

	test('rejects a record claiming another type', () => {
		expect(
			isValidRecord(TRACK, {$type: CHAT_MESSAGE, url: 'https://x.y', title: 'A', createdAt: now})
		).toBe(false)
	})

	test('passes collections that are not ours', () => {
		expect(isValidRecord('app.bsky.feed.post', {anything: true})).toBe(true)
	})
})
