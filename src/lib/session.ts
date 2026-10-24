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
