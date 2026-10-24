import {writable, type Writable} from 'svelte/store'
import {bskyOAuth} from '../services/bsky-oauth'

interface SessionData {
	did: string | null
	handle: string | null
}

interface SessionStore extends Writable<SessionData> {
	refresh: () => void
}

function createSessionStore(): SessionStore {
	const {subscribe, set, update} = writable<SessionData>({did: null, handle: null})

	function refresh(): void {
		const did = bskyOAuth.session?.did || null
		const handle = bskyOAuth.session?.handle || null
		set({did, handle})
	}

	// initialize from current session
	refresh()

	return {subscribe, refresh, set, update}
}

export const session = createSessionStore()
