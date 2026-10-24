import {expect, test} from 'vitest'
import {buildAtprotoLoopbackClientId, parseAtprotoLoopbackClientId} from '@atproto/oauth-types'
import {OAUTH_SCOPE, repoScopes} from './oauth'

test('the OAuth scope is valid for a loopback client', () => {
	const id = buildAtprotoLoopbackClientId({
		scope: OAUTH_SCOPE,
		redirect_uris: ['http://127.0.0.1:5173/']
	})
	expect(parseAtprotoLoopbackClientId(id).scope).toBe(OAUTH_SCOPE)
})

test('asks only for our own collections, and image uploads', () => {
	expect(OAUTH_SCOPE.split(' ')).toEqual([
		'atproto',
		'repo:radio.4000.track',
		'repo:radio.4000.channel?action=create&action=update',
		'repo:radio.4000.follow',
		'repo:radio.4000.broadcast',
		'blob:image/*'
	])
})

test('repo scopes list actions only when not all of them', () => {
	expect(
		repoScopes([
			{resource: 'repo', collection: ['a.b.c'], action: ['create', 'update', 'delete']},
			{resource: 'repo', collection: ['a.b.d'], action: ['create']},
			{resource: 'rpc', collection: []}
		])
	).toEqual(['repo:a.b.c', 'repo:a.b.d?action=create'])
})
