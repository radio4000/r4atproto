import {describe, it, expect} from 'vitest'
import {bskyOAuth} from '../services/bsky-oauth'

describe('Integration tests', () => {
	it('OAuth service should be available', () => {
		expect(bskyOAuth).toBeDefined()
		expect(typeof bskyOAuth.signIn).toBe('function')
		expect(typeof bskyOAuth.signOut).toBe('function')
		expect(typeof bskyOAuth.post).toBe('function')
		expect(typeof bskyOAuth.isAuthenticated).toBe('function')
		expect(typeof bskyOAuth.restoreSession).toBe('function')
	})
})
