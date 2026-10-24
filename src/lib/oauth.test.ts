import {test, expect} from 'vitest'
import {buildAtprotoLoopbackClientId, parseAtprotoLoopbackClientId} from '@atproto/oauth-types'
import {OAUTH_SCOPE} from './oauth'
test('the OAuth scope is valid for a loopback client', () => {
	const id = buildAtprotoLoopbackClientId({
		scope: OAUTH_SCOPE,
		redirect_uris: ['http://127.0.0.1:5173/']
	})
	expect(parseAtprotoLoopbackClientId(id).scope).toBe(OAUTH_SCOPE)
})
