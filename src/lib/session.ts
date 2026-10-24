/**
 * The signed-in account, mirrored into appState: its DID and handle, and its channel.
 */
import {appState} from '#lib/app-state.svelte.js'
import {bskyOAuth} from '#lib/services/bsky-oauth.js'
import {fetchChannels} from '#lib/collections/channels.js'
import {loadUserFollows} from '#lib/collections/follows.js'

export async function syncSession() {
	const did = bskyOAuth.session?.did
	if (!did) {
		appState.session = undefined
		appState.channel = undefined
		for (const deck of Object.values(appState.decks)) deck.broadcasting_channel_id = undefined
		return
	}
	const [channel] = await fetchChannels([did]).catch(() => [])
	appState.session = {did, handle: channel?.slug ?? bskyOAuth.session?.handle ?? did}
	appState.channel = channel
	loadUserFollows().catch(() => {})
}

const REDIRECT_KEY = 'r4-auth-redirect'

/** Start OAuth for `handle`; after the round trip the app returns to `redirect`. */
export async function signIn(handle: string, redirect?: string) {
	try {
		sessionStorage.setItem(REDIRECT_KEY, redirect || '/')
	} catch {}
	const result = await bskyOAuth.signIn(handle.trim().replace(/^@/, ''))
	if (result.error) throw new Error(result.error.message)
}

export async function signOut() {
	await bskyOAuth.signOut()
	await syncSession()
}

/** Where to go after signing in, once */
export function takeAuthRedirect(): string | undefined {
	try {
		const redirect = sessionStorage.getItem(REDIRECT_KEY) ?? undefined
		sessionStorage.removeItem(REDIRECT_KEY)
		return redirect
	} catch {
		return undefined
	}
}
