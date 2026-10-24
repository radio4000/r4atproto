/**
 * Radio4000 Sync Service
 * Handles syncing data from Radio4000 legacy platform to AT Protocol
 */

import {TID} from '@atproto/common-web'
import {TRACK} from '../../lexicons'
import {trackToRecord} from '../atproto/track-record'
import {assertAgent, withRetry} from '../../utils/atproto-client'
import {listAllTracksByDid} from '../atproto/tracks.service'
import type {Radio4000Channel, Radio4000Track} from '../../types'

/** A TID for an ISO date. The clock id is random, so equal timestamps don't collide. */
export function tidFromDate(iso: string): string {
	const micros = new Date(iso).getTime() * 1000
	return TID.fromTime(micros, Math.floor(Math.random() * 1024)).toString()
}

/**
 * Fetch a Radio4000 channel from the legacy API
 */
export async function fetchRadio4000Channel(
	apiEndpoint: string,
	apiKey: string,
	channelSlug: string
): Promise<Radio4000Channel | null> {
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
export async function fetchRadio4000Tracks(
	apiEndpoint: string,
	apiKey: string,
	channelSlug: string
): Promise<Radio4000Track[]> {
	// First get the channel to get its ID
	const channel = await fetchRadio4000Channel(apiEndpoint, apiKey, channelSlug)
	if (!channel) throw new Error('Channel not found')

	// Now fetch tracks for this channel with proper ordering
	// Order by channel_track.created_at to preserve the order tracks were added to the channel
	const url = `${apiEndpoint}/rest/v1/channels?slug=eq.${encodeURIComponent(channelSlug)}&select=tracks:channel_track(created_at,track:tracks(id,url,title,description,discogs_url,created_at,updated_at))&tracks.order=created_at.asc`
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
 * Import Radio4000 tracks into AT Protocol
 * Skips tracks that already exist (by URL)
 */
export async function importRadio4000Tracks(
	apiEndpoint: string,
	apiKey: string,
	channelSlug: string,
	onProgress?: (current: number, total: number, skipped: number) => void,
	onError?: (error: string) => void
): Promise<{imported: number; skipped: number}> {
	const agent = assertAgent()
	const myDid = agent.accountDid!

	// Get all radio4000 tracks (ordered chronologically)
	const r4Tracks = await fetchRadio4000Tracks(apiEndpoint, apiKey, channelSlug)

	// Get existing tracks to check for duplicates
	const existingTracks = await listAllTracksByDid(myDid)
	const existingUrls = new Set(existingTracks.map((t) => t.url.toLowerCase().trim()))

	// Filter out duplicates
	const tracksToImport = r4Tracks.filter((track) => {
		const normalizedUrl = track.url.toLowerCase().trim()
		return !existingUrls.has(normalizedUrl)
	})

	const skipped = r4Tracks.length - tracksToImport.length
	let imported = 0

	// Process in batches of 200 (AT Protocol limit per applyWrites call)
	const BATCH_SIZE = 200

	for (let i = 0; i < tracksToImport.length; i += BATCH_SIZE) {
		const batch = tracksToImport.slice(i, i + BATCH_SIZE)

		try {
			// rkeys are TIDs made from when the track was added on radio4000.com,
			// so imported tracks sort among manually added ones by date.
			const writes = batch.map((track) => ({
				$type: 'com.atproto.repo.applyWrites#create' as const,
				collection: TRACK,
				rkey: tidFromDate(track.created_at),
				value: trackToRecord({
					url: track.url,
					title: track.title,
					description: track.description || undefined,
					discogs_url: track.discogs_url || undefined,
					r4_id: track.id,
					created_at: track.created_at,
					updated_at: track.updated_at
				})
			}))

			// Execute batch create with retry logic
			await withRetry(() =>
				agent.com.atproto.repo.applyWrites({
					repo: myDid,
					writes
				})
			)

			imported += batch.length
			onProgress?.(imported, tracksToImport.length, skipped)
		} catch (error) {
			const msg = String((error as Error)?.message || error)
			onError?.(`Failed to import batch: ${msg}`)
			// Continue with next batch despite error
		}
	}

	return {imported, skipped}
}
