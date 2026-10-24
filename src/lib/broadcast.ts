/**
 * Broadcast: sharing what a radio plays live. Wired up in a later step (a
 * radio.4000.broadcast record + Jetstream); until then nobody broadcasts.
 */
import {appState} from '#lib/app-state.svelte.js'

/** Channel id (DID) the signed-in account broadcasts as, if any deck broadcasts */
export function getBroadcastingChannelId(): string | undefined {
	return Object.values(appState.decks).find((d) => d.broadcasting_channel_id)
		?.broadcasting_channel_id
}

export function notifyBroadcastState(_channelId: string) {}

export async function upsertRemoteBroadcast(_channelId: string) {}

/** Stop listening to a broadcast on this deck */
export function leaveBroadcast(deckId: number) {
	const deck = appState.decks[deckId]
	if (!deck) return
	deck.listening_to_channel_id = undefined
	deck.listening_drifted = undefined
}

/** Re-sync a drifted listening deck to the broadcast */
export async function resyncBroadcastDeck(_deckId: number) {}
