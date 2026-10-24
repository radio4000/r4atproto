/**
 * Import a radio4000.com channel into the signed-in account's radio.
 * radio4000.com has a public, anonymous API (see config/app.json).
 */
import {TID} from '@atproto/common-web'
import app from '#lib/config/app.json' with {type: 'json'}
import {TRACK} from '#lib/lexicons.js'
import {trackToRecord} from '#lib/atproto/records.js'
import {createRecords, myDid, updateRecords} from '#lib/atproto/write.js'
import {parseAtUri} from '#lib/atproto/repo.js'
import {fetchTracksBySlug} from '#lib/collections/tracks.js'
import type {Track} from '#lib/types.js'

const {apiEndpoint, apiKey} = app.radio4000

export interface Radio4000Track {
	id: string
	url: string
	title: string
	description?: string | null
	discogs_url?: string | null
	/** Seconds, when radio4000.com knows it. Auto radio needs durations. */
	duration?: number | null
	created_at: string
	updated_at?: string
}

export interface Radio4000Channel {
	id: string
	slug: string
	name: string
	description?: string | null
	created: string
	updated?: string
}

const BATCH_SIZE = 200

/** A TID for an ISO date. The clock id is random, so equal timestamps don't collide. */
export function tidFromDate(iso: string): string {
	const micros = new Date(iso).getTime() * 1000
	return TID.fromTime(micros, Math.floor(Math.random() * 1024)).toString()
}

/**
 * Fetch a Radio4000 channel from the legacy API
 */
export async function fetchRadio4000Channel(channelSlug: string): Promise<Radio4000Channel | null> {
	const url = `${apiEndpoint}/rest/v1/channels?slug=eq.${encodeURIComponent(channelSlug)}&select=id,slug,name,description`
	const res = await fetch(url, {
		headers: {
			apikey: apiKey,
			accept: 'application/json'
		}
	})
	if (!res.ok) throw new Error(`Failed to fetch channel: ${res.statusText}`)
	const data = await res.json()
	if (!Array.isArray(data) || data.length === 0) return null
	return data[0]
}

/**
 * Fetch all tracks for a Radio4000 channel
 */
export async function fetchRadio4000Tracks(channelSlug: string): Promise<Radio4000Track[]> {
	// First get the channel to get its ID
	const channel = await fetchRadio4000Channel(channelSlug)
	if (!channel) throw new Error('Channel not found')

	// Now fetch tracks for this channel with proper ordering
	// Order by channel_track.created_at to preserve the order tracks were added to the channel
	const url = `${apiEndpoint}/rest/v1/channels?slug=eq.${encodeURIComponent(channelSlug)}&select=tracks:channel_track(created_at,track:tracks(id,url,title,description,discogs_url,duration,created_at,updated_at))&tracks.order=created_at.asc`
	const res = await fetch(url, {
		headers: {
			apikey: apiKey,
			accept: 'application/json'
		}
	})
	if (!res.ok) throw new Error(`Failed to fetch tracks: ${res.statusText}`)
	const data = await res.json()
	if (!Array.isArray(data) || data.length === 0) return []

	const channelData = data[0]
	if (!channelData.tracks || !Array.isArray(channelData.tracks)) return []

	// Extract tracks from the nested structure
	// Tracks are already ordered by channel_track.created_at ascending (oldest first)
	// Preserve the channel_track.created_at as that's when the track was added to the channel
	return channelData.tracks
		.map((item: {created_at: string; track: Radio4000Track | null}) => {
			if (!item.track) return null
			return {
				...item.track,
				// Override track.created_at with channel_track.created_at to preserve add order
				created_at: item.created_at
			}
		})
		.filter(Boolean) as Radio4000Track[]
}

/**
 * Import the tracks of a radio4000.com channel, skipping URLs the radio already has.
 * Records get TIDs from their original add date, so they sort among new tracks by date.
 * Tracks imported before, still without a duration, get radio4000.com's.
 */
export async function importRadio4000Tracks(
	channelSlug: string,
	onProgress?: (done: number, total: number) => void
): Promise<{imported: number; skipped: number}> {
	const did = myDid()
	if (!did) throw new Error('Not signed in')
	const [r4Tracks, existing] = await Promise.all([
		fetchRadio4000Tracks(channelSlug),
		fetchTracksBySlug(did)
	])
	const existingUrls = new Set(existing.map((t) => t.url.toLowerCase().trim()))
	const toImport = r4Tracks.filter((t) => !existingUrls.has(t.url.toLowerCase().trim()))

	await fillDurations(existing, r4Tracks)

	let imported = 0
	for (let i = 0; i < toImport.length; i += BATCH_SIZE) {
		const batch = toImport.slice(i, i + BATCH_SIZE)
		await createRecords(
			TRACK,
			batch.map((track) => ({
				rkey: tidFromDate(track.created_at),
				value: trackToRecord({
					url: track.url,
					title: track.title,
					description: track.description || undefined,
					discogs_url: track.discogs_url || undefined,
					duration: track.duration ? Math.round(track.duration) : null,
					r4_id: track.id,
					created_at: track.created_at,
					updated_at: track.updated_at
				})
			}))
		)
		imported += batch.length
		onProgress?.(imported, toImport.length)
	}
	return {imported, skipped: r4Tracks.length - toImport.length}
}

/** Add radio4000.com's durations to already imported tracks that have none */
async function fillDurations(existing: Track[], r4Tracks: Radio4000Track[]) {
	const durations = new Map(
		r4Tracks.filter((t) => t.duration).map((t) => [t.url.toLowerCase().trim(), t.duration])
	)
	const updates = existing.flatMap((track) => {
		const duration = durations.get(track.url.toLowerCase().trim())
		if (track.duration || !duration) return []
		const value = trackToRecord({...track, duration: Math.round(duration)})
		return [{rkey: parseAtUri(track.id).rkey, value}]
	})
	for (let i = 0; i < updates.length; i += BATCH_SIZE) {
		await updateRecords(TRACK, updates.slice(i, i + BATCH_SIZE))
	}
}
