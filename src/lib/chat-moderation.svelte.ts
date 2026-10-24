/**
 * Accounts you mute in chat. Mutes are private: they stay in this browser
 * (localStorage), never in your repo. Blocks are public, see chat-blocks.ts.
 */
import {LOCAL_STORAGE_KEYS} from '#lib/storage-keys.js'

/** DIDs muted in chat, in this browser only */
export const mutedAuthors: string[] = $state(loadMuted())

function loadMuted(): string[] {
	try {
		const value = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.chatMuted) ?? '[]')
		return Array.isArray(value) ? value.filter((did) => typeof did === 'string') : []
	} catch {
		return []
	}
}

function saveMuted() {
	try {
		localStorage.setItem(LOCAL_STORAGE_KEYS.chatMuted, JSON.stringify(mutedAuthors))
	} catch {
		// Private mode or full storage: mutes last for this visit
	}
}

export function muteAuthor(did: string) {
	if (mutedAuthors.includes(did)) return
	mutedAuthors.push(did)
	saveMuted()
}

export function unmuteAuthor(did: string) {
	const index = mutedAuthors.indexOf(did)
	if (index === -1) return
	mutedAuthors.splice(index, 1)
	saveMuted()
}
