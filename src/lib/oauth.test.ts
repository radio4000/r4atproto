import {expect, test} from 'vitest'
import {buildAtprotoLoopbackClientId, parseAtprotoLoopbackClientId} from '@atproto/oauth-types'
import {OAUTH_SCOPE, repoScopes} from './oauth'
import authFull from '../../lexicons/radio/4000/authFull.json' with {type: 'json'}

test('the OAuth scope is valid for a loopback client', () => {
	const id = buildAtprotoLoopbackClientId({
		scope: OAUTH_SCOPE,
		redirect_uris: ['http://127.0.0.1:5173/']
	})
	expect(parseAtprotoLoopbackClientId(id).scope).toBe(OAUTH_SCOPE)
})

test('asks for the published permission set, and image uploads', () => {
	expect(OAUTH_SCOPE.split(' ')).toEqual(['atproto', 'include:radio.4000.authFull', 'blob:image/*'])
})

test('the permission set covers only our own collections', () => {
	expect(repoScopes(authFull.defs.main.permissions)).toEqual([
		'repo:radio.4000.track',
		'repo:radio.4000.channel?action=create&action=update',
		'repo:radio.4000.follow',
		'repo:radio.4000.broadcast',
		'repo:radio.4000.chat.message?action=create&action=delete'
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
