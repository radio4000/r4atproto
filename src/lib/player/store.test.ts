import {describe, it, expect, beforeEach} from 'vitest'
import {player, setPlaylist, toggleShuffle, shuffleCurrentPlaylist} from './store'

describe('player store', () => {
	beforeEach(() => {
		// Reset player state before each test
		player.set({
			context: null,
			customPlaylist: null,
			index: -1,
			playing: false,
			isShuffled: false
		})
	})

	describe('shuffle functionality', () => {
		it('should shuffle a playlist when shuffleCurrentPlaylist is called', () => {
			const tracks = [
				{url: 'https://example.com/1', title: 'Track 1'},
				{url: 'https://example.com/2', title: 'Track 2'},
				{url: 'https://example.com/3', title: 'Track 3'},
				{url: 'https://example.com/4', title: 'Track 4'},
				{url: 'https://example.com/5', title: 'Track 5'}
			]

			shuffleCurrentPlaylist(tracks)

			const state = player.get()

			expect(state.isShuffled).toBe(true)
			expect(state.customPlaylist).toHaveLength(5)
			expect(state.originalPlaylist).toEqual(tracks)
			expect(state.index).toBe(0)

			// Shuffled playlist should contain all the same tracks
			expect(state.customPlaylist?.every((track) => tracks.some((t) => t.url === track.url))).toBe(
				true
			)
		})

		it('should set shuffle flag when toggleShuffle is called without playlist', () => {
			toggleShuffle()

			const state = player.get()
			expect(state.isShuffled).toBe(true)
			expect(state.customPlaylist).toBe(null)
		})

		it('should shuffle existing customPlaylist when toggleShuffle is called', () => {
			const tracks = [
				{url: 'https://example.com/1', title: 'Track 1'},
				{url: 'https://example.com/2', title: 'Track 2'},
				{url: 'https://example.com/3', title: 'Track 3'}
			]

			setPlaylist(tracks, 0, {type: 'discogs', key: 'test'})
			toggleShuffle()

			const state = player.get()

			expect(state.isShuffled).toBe(true)
			expect(state.customPlaylist).toHaveLength(3)
			expect(state.originalPlaylist).toEqual(tracks)
			expect(state.index).toBe(0)
		})

		it('should restore original order when shuffle is turned off', () => {
			const tracks = [
				{url: 'https://example.com/1', title: 'Track 1'},
				{url: 'https://example.com/2', title: 'Track 2'},
				{url: 'https://example.com/3', title: 'Track 3'}
			]

			shuffleCurrentPlaylist(tracks)
			toggleShuffle() // Turn off shuffle

			const state = player.get()

			expect(state.isShuffled).toBe(false)
			expect(state.customPlaylist).toBe(null)
			expect(state.originalPlaylist).toBe(undefined)
		})

		it('should not crash with empty playlist', () => {
			shuffleCurrentPlaylist([])
			const state = player.get()

			// Should not have changed state
			expect(state.isShuffled).toBe(false)
			expect(state.customPlaylist).toBe(null)
		})
	})

	describe('setPlaylist', () => {
		it('should set playlist with context', () => {
			const tracks = [
				{url: 'https://example.com/1', title: 'Track 1'},
				{url: 'https://example.com/2', title: 'Track 2'}
			]
			const context = {type: 'profile' as const, key: 'did:plc:test'}

			setPlaylist(tracks, 1, context)

			const state = player.get()
			expect(state.customPlaylist).toEqual(tracks)
			expect(state.index).toBe(1)
			expect(state.playing).toBe(true)
			expect(state.context).toEqual(context)
			expect(state.isShuffled).toBe(false)
		})

		it('should reset shuffle when setting new playlist', () => {
			const tracks = [{url: 'https://example.com/1', title: 'Track 1'}]

			// First shuffle
			shuffleCurrentPlaylist(tracks)
			expect(player.get().isShuffled).toBe(true)

			// Set new playlist
			setPlaylist(tracks, 0, null)
			expect(player.get().isShuffled).toBe(false)
		})
	})
})
