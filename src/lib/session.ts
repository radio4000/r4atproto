/**
 * The signed-in account, mirrored into appState: its DID and handle, and its channel.
 */
import {appState} from '#lib/app-state.svelte.js'
import * as oauth from '#lib/atproto/oauth-client.js'
import {resolveIdentity} from '#lib/atproto/identity.js'
import {fetchChannels} from '#lib/collections/channels.js'
import {loadUserFollows} from '#lib/collections/follows.js'

export async function syncSession() {
	const did = oauth.getDid()
	if (!did) {
		appState.session = undefined
		appState.channel = undefined
		for (const deck of Object.values(appState.decks)) deck.broadcasting_channel_id = undefined
		return
	}
	const [identity, [channel]] = await Promise.all([
		resolveIdentity(did).catch(() => undefined),
		fetchChannels([did]).catch(() => [])
	])
	appState.session = {did, handle: channel?.slug ?? identity?.handle ?? did}
	appState.channel = channel
	loadUserFollows().catch(() => {})
}

/** Load OAuth and the session. Resolves with where to go after a sign-in round trip. */
export async function initSession(): Promise<string | undefined> {
	const {returnTo} = await oauth.initOAuth()
	await syncSession()
	return returnTo
}

/** Start OAuth for `handle`; after the round trip the app returns to `returnTo`. */
export function signIn(handle: string, returnTo?: string) {
	return oauth.signIn(handle.trim().replace(/^@/, ''), returnTo || '/')
}

export async function signOut() {
	await oauth.signOut()
	await syncSession()
}

export const renewPermissions = oauth.renewPermissions
