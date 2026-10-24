/**
 * Broadcast: a radio shares what its decks play, and listeners follow in sync.
 *
 * The broadcaster writes its radio.4000.broadcast record (rkey "self") on every
 * track change, pause, seek or speed change (debounced), and as a heartbeat while
 * live; stopping deletes it. Listeners get changes from the broadcasts collection
 * (Jetstream) and apply them to listener decks with r4's sync logic: same track,
 * seeked to the broadcaster's position, re-synced when drifted.
 */
import {tick} from 'svelte'
import app from '#lib/config/app.json' with {type: 'json'}
import {appState, addDeck, removeDeck} from '#lib/app-state.svelte.js'
import {
	applyRemoteState,
	clearUserInitiatedPlay,
	getMediaPlayer,
	play,
	playChannel,
	playTrack,
	seekTo,
	setUserInitiatedPlay,
	type MediaPlayer
} from '#lib/api.js'
import {sortedDeckIds} from '#lib/deck.js'
import {BROADCAST, SELF} from '#lib/lexicons.js'
import {deleteRecord, putRecord} from '#lib/atproto/write.js'
import {broadcastToRecord, type BroadcastDeckRecord} from '#lib/atproto/records.js'
import {ensureTracksLoaded, tracksCollection} from '#lib/collections/tracks.js'
import {
	broadcastsCollection,
	fetchBroadcast,
	removeBroadcast,
	upsertBroadcast
} from '#lib/collections/broadcasts.js'
import {
	calculateSeekTime,
	DRIFT_TOLERANCE_SECONDS,
	pickBroadcastFields,
	unpackEphemeralTrack
} from '#lib/broadcast-utils.js'
import {logger} from '#lib/logger.js'
import type {BroadcastDeckState, Track} from '#lib/types.js'

const log = logger.ns('broadcast').seal()
const config = app.broadcast

// --- Broadcasting ---

let writeTimer: ReturnType<typeof setTimeout> | undefined
let heartbeat: ReturnType<typeof setInterval> | undefined
let liveness: ReturnType<typeof setInterval> | undefined
let idleSince: number | undefined

/** Channel id (DID) the signed-in account broadcasts as, if any deck broadcasts */
export function getBroadcastingChannelId(): string | undefined {
	return Object.values(appState.decks).find((d) => d.broadcasting_channel_id)
		?.broadcasting_channel_id
}

/** Local decks, i.e. not listening to someone else's broadcast */
function broadcasterDeckIds() {
	return sortedDeckIds(appState.decks).filter((id) => !appState.decks[id]?.listening_to_channel_id)
}

/** What each local deck plays, as broadcast record decks */
function deckRecords(): BroadcastDeckRecord[] {
	return broadcasterDeckIds().flatMap((id) => {
		const deck = appState.decks[id]
		const track = deck?.playlist_track ? tracksCollection.get(deck.playlist_track) : undefined
		if (!deck || !track) return []
		const position = getMediaPlayer(id)?.currentTime ?? deck.media_current_time ?? 0
		return [
			{
				track: track.id,
				url: track.url,
				title: track.title,
				positionMs: Math.max(0, Math.round(position * 1000)),
				positionAt: new Date().toISOString(),
				playing: Boolean(deck.is_playing),
				speed: Math.round((deck.speed ?? 1) * 100)
			}
		]
	})
}

/** Write the broadcast record now */
export async function upsertRemoteBroadcast(channelId: string) {
	const decks = deckRecords()
	if (!decks.length) return
	const record = broadcastToRecord(decks)
	await putRecord(BROADCAST, SELF, record)
	upsertBroadcast({
		channel_id: channelId,
		updated_at: record.updatedAt,
		decks: decks.map((d, index) => ({
			index,
			track_id: d.track,
			track_url: d.url,
			track_title: d.title ?? null,
			track_played_at: null,
			seek_position: d.positionMs / 1000,
			seeked_at: d.positionAt,
			is_playing: d.playing,
			speed: (d.speed ?? 100) / 100
		}))
	})
}

/** Something changed on a broadcasting deck: write it soon */
export function notifyBroadcastState(channelId: string) {
	clearTimeout(writeTimer)
	writeTimer = setTimeout(() => {
		upsertRemoteBroadcast(channelId).catch((error) => log.warn('write_failed', error))
	}, config.writeDebounceMs)
}

/** Stop when no local deck is left, or nothing played for broadcast.idleStopSeconds */
function checkLiveness(channelId: string) {
	const ids = broadcasterDeckIds()
	const playing = ids.some((id) => appState.decks[id]?.is_playing)
	if (playing) idleSince = undefined
	else idleSince ??= Date.now()
	const idle = idleSince !== undefined && Date.now() - idleSince > config.idleStopSeconds * 1000
	if (!ids.length || idle)
		stopBroadcast(channelId).catch((error) => log.warn('auto_stop_failed', error))
}

/**
 * Go live with the signed-in radio from whatever plays; when nothing does, start
 * playing the radio itself. Resolves false when there is nothing to broadcast.
 */
export async function startBroadcast(): Promise<boolean> {
	const session = appState.session
	if (!session) return false
	let deck =
		Object.values(appState.decks).find(
			(d) => d.is_playing && d.playlist_track && !d.listening_to_channel_id
		) ?? appState.decks[appState.active_deck_id]
	if (!deck?.playlist_track) {
		await playChannel(appState.active_deck_id, {id: session.did, slug: session.handle})
		deck = appState.decks[appState.active_deck_id]
	}
	if (!deck?.playlist_track) return false
	deck.broadcasting_channel_id = session.did
	await upsertRemoteBroadcast(session.did)
	clearInterval(heartbeat)
	clearInterval(liveness)
	idleSince = undefined
	heartbeat = setInterval(
		() => upsertRemoteBroadcast(session.did).catch((error) => log.warn('heartbeat_failed', error)),
		config.heartbeatSeconds * 1000
	)
	liveness = setInterval(() => checkLiveness(session.did), 30_000)
	log.log('started', session.handle)
	return true
}

export async function stopBroadcast(channelId = getBroadcastingChannelId()) {
	clearTimeout(writeTimer)
	clearInterval(heartbeat)
	clearInterval(liveness)
	for (const deck of Object.values(appState.decks)) deck.broadcasting_channel_id = undefined
	if (!channelId) return
	removeBroadcast(channelId)
	await deleteRecord(BROADCAST, SELF)
	log.log('stopped')
}

// --- Listening ---

const seekJobs = new Map<number, number>()
let following: {channelId: string; unsubscribe: () => void} | undefined

function managedListenerIds(channelId: string) {
	return sortedDeckIds(appState.decks).filter(
		(id) => appState.decks[id]?.listening_to_channel_id === channelId
	)
}

function closeListeningDecksForChannel(channelId: string) {
	for (const id of managedListenerIds(channelId)) {
		seekJobs.delete(id)
		clearUserInitiatedPlay(id)
		removeDeck(id)
	}
}

function nextSeekJob(deckId: number) {
	const next = (seekJobs.get(deckId) ?? 0) + 1
	seekJobs.set(deckId, next)
	return next
}

/** Seek once the media element can, retrying until the position lands */
async function seekWhenReady(deckId: number, seconds: number, job: number) {
	const deadline = performance.now() + 8000
	let media: MediaPlayer | null = null
	while (performance.now() < deadline) {
		if (seekJobs.get(deckId) !== job) return
		media = getMediaPlayer(deckId)
		if (media && ((Number.isFinite(media.duration) && media.duration > 0) || media.currentTime > 0))
			break
		await new Promise((r) => setTimeout(r, 100))
	}
	if (!media || seekJobs.get(deckId) !== job) return
	seekTo(deckId, seconds)
	for (let tries = 10; tries > 0; tries--) {
		if (seekJobs.get(deckId) !== job || Math.abs(media.currentTime - seconds) < 1) break
		seekTo(deckId, seconds)
		await new Promise((r) => setTimeout(r, 200))
	}
	if (seekJobs.get(deckId) === job && appState.decks[deckId]?.is_playing) play(deckId)
}

function applyToMedia(media: MediaPlayer | null, state: Partial<BroadcastDeckState>) {
	if (!media) return
	if (state.is_playing && media.paused) media.play()
	if (state.is_playing === false && !media.paused) media.pause()
	if (typeof state.speed === 'number' && 'playbackRate' in media) {
		;(media as MediaPlayer & {playbackRate: number}).playbackRate = state.speed
	}
}

async function playBroadcastTrack(deckId: number, channelId: string, state: BroadcastDeckState) {
	if (!state.track_id) return
	let track: Track | undefined = tracksCollection.get(state.track_id)
	if (!track) {
		// Not loaded (or not a record): play it from the URL the broadcast carries
		track = unpackEphemeralTrack(state.track_id, state)
		if (!track) return
		if (!tracksCollection.isReady()) tracksCollection.startSyncImmediate()
		tracksCollection.utils.writeUpsert(track)
	}
	const seekTime = calculateSeekTime(state, track)
	setUserInitiatedPlay(deckId, true)
	await playTrack(deckId, state.track_id, null, 'broadcast_sync')
	if (seekTime !== undefined) await seekWhenReady(deckId, seekTime, nextSeekJob(deckId))
	if (!appState.decks[deckId]) return
	applyRemoteState(deckId, {
		listening_to_channel_id: channelId,
		listening_drifted: false,
		...pickBroadcastFields(state)
	})
	applyToMedia(getMediaPlayer(deckId), state)
	// YouTube resets the playback rate when a video loads
	setTimeout(() => applyToMedia(getMediaPlayer(deckId), state), 1000)
}

async function syncDeckToBroadcastState(
	deckId: number,
	channelId: string,
	state: BroadcastDeckState
) {
	const deck = appState.decks[deckId]
	if (!deck) return
	const trackChanged = deck.playlist_track !== state.track_id
	applyRemoteState(deckId, {
		listening_to_channel_id: channelId,
		listening_drifted: false,
		...pickBroadcastFields(state)
	})
	if (trackChanged) return playBroadcastTrack(deckId, channelId, state)
	const media = getMediaPlayer(deckId)
	applyToMedia(media, state)
	const track = state.track_id ? tracksCollection.get(state.track_id) : undefined
	const seekTime = track ? calculateSeekTime(state, track) : undefined
	if (seekTime === undefined) return
	if (media && Math.abs(media.currentTime - seekTime) < DRIFT_TOLERANCE_SECONDS) return
	await seekWhenReady(deckId, seekTime, nextSeekJob(deckId))
}

/** One listener deck per broadcast deck, matched by track, then by position */
async function applyBroadcastState(channelId: string, decks: BroadcastDeckState[]) {
	if (!decks.length) return
	let ids = managedListenerIds(channelId)
	while (ids.length < decks.length) {
		const deck = addDeck()
		deck.listening_to_channel_id = channelId
		deck.hide_queue_panel = true
		ids = managedListenerIds(channelId)
	}
	if (ids.length > decks.length) {
		for (const id of ids.slice(decks.length)) {
			clearUserInitiatedPlay(id)
			removeDeck(id)
		}
		ids = managedListenerIds(channelId)
		await tick()
	}
	const used = new Set<number>()
	const assigned: (number | undefined)[] = decks.map((state) => {
		const match = ids.find(
			(id) => !used.has(id) && appState.decks[id]?.playlist_track === state.track_id
		)
		if (match !== undefined) used.add(match)
		return match
	})
	decks.forEach((state, index) => {
		const deckId = assigned[index] ?? ids.find((id) => !used.has(id))
		if (deckId === undefined) return
		used.add(deckId)
		void syncDeckToBroadcastState(deckId, channelId, state)
	})
}

function stopFollowing() {
	following?.unsubscribe()
	following = undefined
}

/** Follow a broadcast's changes until it ends or we leave */
function follow(channelId: string) {
	stopFollowing()
	const subscription = broadcastsCollection.subscribeChanges((changes) => {
		for (const change of changes) {
			if (change.key !== channelId) continue
			if (change.type === 'delete') {
				stopFollowing()
				closeListeningDecksForChannel(channelId)
			} else {
				void applyBroadcastState(channelId, change.value.decks)
			}
		}
	})
	following = {channelId, unsubscribe: () => subscription.unsubscribe()}
}

/** Listen to a radio's broadcast: the decks are replaced by its decks */
export async function joinBroadcast(_deckId: number, channelId: string) {
	const broadcast = broadcastsCollection.get(channelId) ?? (await fetchBroadcast(channelId))
	if (!broadcast?.decks.length) return
	await ensureTracksLoaded(channelId).catch(() => {})
	for (const id of sortedDeckIds(appState.decks)) {
		seekJobs.delete(id)
		clearUserInitiatedPlay(id)
		removeDeck(id)
	}
	await applyBroadcastState(channelId, broadcast.decks)
	const listenerIds = managedListenerIds(channelId)
	if (listenerIds.length) appState.active_deck_id = listenerIds[0]
	follow(channelId)
	log.log('joined', channelId)
}

/** Stop listening; the listener decks close */
export function leaveBroadcast(deckId: number) {
	const channelId = appState.decks[deckId]?.listening_to_channel_id
	if (!channelId) return
	if (following?.channelId === channelId) stopFollowing()
	closeListeningDecksForChannel(channelId)
}

/** Bring a drifted listener deck back to the broadcast's position */
export async function resyncBroadcastDeck(deckId: number) {
	const deck = appState.decks[deckId]
	const channelId = deck?.listening_to_channel_id
	if (!channelId) return
	const broadcast = broadcastsCollection.get(channelId) ?? (await fetchBroadcast(channelId))
	const decks = broadcast?.decks
	if (!decks?.length) return
	const index = Math.max(0, managedListenerIds(channelId).indexOf(deckId))
	const state = decks.find((d) => d.track_id === deck.playlist_track) ?? decks[index] ?? decks[0]
	await syncDeckToBroadcastState(deckId, channelId, state)
}
