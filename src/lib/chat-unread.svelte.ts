/**
 * Unread chat messages, for your own radio and the radios you listen to.
 *
 * What you have read is private: it stays in this browser (localStorage), never in
 * your repo. Your radio counts messages since you last opened its chat; a radio you
 * listen to counts messages since you started listening.
 */
import {TID} from '@atproto/common-web'
import {appState} from '#lib/app-state.svelte.js'
import {CHAT_MESSAGE} from '#lib/lexicons.js'
import {subscribe} from '#lib/atproto/jetstream.js'
import {fetchChatRefs, type ChatMessageRecord} from '#lib/chat.js'
import {roomBlocks} from '#lib/chat-blocks.js'
import {mutedAuthors} from '#lib/chat-moderation.svelte.js'
import {LOCAL_STORAGE_KEYS} from '#lib/storage-keys.js'

/** Unread messages per radio DID */
export const unreadChat: Record<string, number> = $state({})

/** When each radio's chat was last read (ms), persisted in this browser only */
const seen: Record<string, number> = loadSeen()
/** When you started listening to each radio (ms), for this session */
const listeningSince: Record<string, number> = {}
/** Rooms open right now: their messages are read as they arrive */
// eslint-disable-next-line svelte/prefer-svelte-reactivity -- bookkeeping, not rendered
const openRooms = new Set<string>()

function loadSeen(): Record<string, number> {
	try {
		return JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.chatSeen) ?? '{}')
	} catch {
		return {}
	}
}

function saveSeen() {
	try {
		localStorage.setItem(LOCAL_STORAGE_KEYS.chatSeen, JSON.stringify(seen))
	} catch {
		// Private mode or full storage: counts just reset on reload
	}
}

/** Mark a radio's chat read now */
function markChatRead(radioDid: string) {
	seen[radioDid] = Date.now()
	saveSeen()
	delete unreadChat[radioDid]
}

/** A chat room is on screen: keep it read while open. Returns the close function. */
export function openChatRoom(radioDid: string) {
	openRooms.add(radioDid)
	markChatRead(radioDid)
	return () => {
		openRooms.delete(radioDid)
		markChatRead(radioDid)
	}
}

/** Radios whose chats count: your own and the ones your decks listen to */
function watchedRadios(): Set<string> {
	// eslint-disable-next-line svelte/prefer-svelte-reactivity -- built per call, not state
	const dids = new Set<string>()
	if (appState.session) dids.add(appState.session.did)
	for (const deck of Object.values(appState.decks)) {
		if (deck.listening_to_channel_id) dids.add(deck.listening_to_channel_id)
	}
	return dids
}

const tidTime = (rkey: string) => {
	try {
		return TID.fromStr(rkey).timestamp() / 1000
	} catch {
		return 0
	}
}

/** Messages to your radio since you last read its chat. The record key is a TID, so its
 *  time is known without fetching the record. */
async function countOwnRadio(did: string) {
	const since = seen[did] ?? 0
	const refs = await fetchChatRefs(did).catch(() => [])
	const blocked = await roomBlocks(
		did,
		undefined,
		refs.map((ref) => ref.did)
	)
	const count = refs.filter(
		(ref) => ref.did !== did && !hidden(ref.did, blocked) && tidTime(ref.rkey) > since
	).length
	if (count && !openRooms.has(did)) unreadChat[did] = count
}

/** Messages you don't see in a room don't count */
const hidden = (author: string, blocked: Set<string>) =>
	blocked.has(author) || mutedAuthors.includes(author)

/** Count new messages. Call once, from the root layout's script (it sets up effects). */
export function watchUnreadChat() {
	// A radio you start listening to counts from then
	$effect(() => {
		const watched = watchedRadios()
		for (const did of watched) if (did !== appState.session?.did) listeningSince[did] ??= Date.now()
		for (const did of Object.keys(listeningSince)) if (!watched.has(did)) delete listeningSince[did]
	})

	$effect(() => {
		const did = appState.session?.did
		if (did) countOwnRadio(did)
	})

	// One socket for every room; the effect closes it with the app
	$effect(() =>
		subscribe<ChatMessageRecord>([CHAT_MESSAGE], async ({did, commit}) => {
			const subject = commit.record?.subject
			const reader = appState.session?.did
			if (commit.operation !== 'create' || !subject || did === reader) return
			if (!watchedRadios().has(subject) || openRooms.has(subject)) return
			const since = Math.max(seen[subject] ?? 0, listeningSince[subject] ?? 0)
			if (Date.parse(commit.record?.createdAt ?? '') <= since) return
			if (hidden(did, await roomBlocks(subject, reader, [did]))) return
			unreadChat[subject] = (unreadChat[subject] ?? 0) + 1
		})
	)
}
