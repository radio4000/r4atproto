/**
 * AT Protocol Tracks Service
 * Handles CRUD operations for com.radio4000.track records
 */

import {Agent} from '@atproto/api'
import {assertAgent, withDpopRetry, fetchWithAgentFallback} from '../../utils/atproto-client'
import type {
	Track,
	CreateTrackParams,
	ListTracksOptions,
	ListTracksResult,
	AtProtoRecord
} from '../../types'

export const R4_COLLECTION = 'com.radio4000.track'

/**
 * Create a new track record
 */
export async function createTrack({
	url,
	title,
	description,
	discogs_url,
	r4SupabaseId
}: CreateTrackParams) {
	const agent = assertAgent()
	const record = {
		$type: R4_COLLECTION,
		url,
		title,
		description: description || undefined,
		discogs_url: discogs_url || undefined,
		r4SupabaseId: r4SupabaseId || undefined,
		created_at: new Date().toISOString()
	}

	try {
		return await withDpopRetry(() =>
			agent.com.atproto.repo.createRecord({
				repo: agent.accountDid!,
				collection: R4_COLLECTION,
				record
			})
		)
	} catch (err) {
		const msg = String((err as Error)?.message || err)
		if (msg.includes('repo:com.radio4000.track?action=create')) {
			const e2 = new Error(
				'Missing permission to save to library. Open Settings to re-consent. If on localhost, set a HTTPS client metadata URL and re-login.'
			)
			Object.assign(e2, {code: 'scope-missing'})
			throw e2
		}
		throw err
	}
}

/**
 * List all tracks for a given DID with pagination
 */
export async function listTracksByDid(
	did: string,
	{cursor, limit = 100, reverse = false}: ListTracksOptions = {}
): Promise<ListTracksResult> {
	const res = await fetchWithAgentFallback(
		(agent) =>
			agent.com.atproto.repo.listRecords({
				repo: did,
				collection: R4_COLLECTION,
				limit,
				cursor,
				reverse // Default false to preserve chronological order (oldest first)
			}),
		{did, useAuthForOwn: true}
	)

	const items = (res.data?.records || []).map((r: AtProtoRecord) => ({
		uri: r.uri,
		cid: r.cid,
		rkey: r.uri?.split('/').pop(),
		...r.value
	}))
	const tracks = items as Track[]

	// API returns records ordered by rkey (timestamp-based)
	// reverse=false (default): oldest first - preserves Radio4000 chronological order
	// reverse=true: newest first - for showing recent tracks in UI
	// Both work correctly since rkeys are timestamp-based (from Radio4000 or TID)

	return {tracks, cursor: res.data?.cursor}
}

/**
 * Get a single track by URI
 */
export async function getTrackByUri(uri: string): Promise<Track> {
	const {repo, collection, rkey} = parseAtUri(uri)

	const res = await fetchWithAgentFallback(
		(agent) =>
			agent.com.atproto.repo.getRecord({
				repo,
				collection,
				rkey
			}),
		{did: repo, useAuthForOwn: true}
	)

	// Response has data.uri, data.cid, data.value
	const data = (
		res as unknown as {data: {uri: string; cid: string; value: Record<string, unknown>}}
	).data

	return {
		uri: data.uri,
		cid: data.cid,
		rkey,
		...data.value
	} as Track
}

/**
 * Update a track by URI
 */
export async function updateTrackByUri(uri: string, changes: Partial<Track>) {
	const agent = assertAgent()
	const {repo, collection, rkey} = parseAtUri(uri)

	// Get existing record
	const existing = await agent.com.atproto.repo.getRecord({
		repo,
		collection,
		rkey
	})

	const updated = {
		...(existing as unknown as {data: {value: Record<string, unknown>}}).data.value,
		...changes,
		updated_at: new Date().toISOString()
	}

	return await withDpopRetry(() =>
		agent.com.atproto.repo.putRecord({
			repo,
			collection,
			rkey,
			record: updated
		})
	)
}

/**
 * Delete a track by URI
 */
export async function deleteTrackByUri(uri: string) {
	const agent = assertAgent()
	const {repo, collection, rkey} = parseAtUri(uri)

	return await withDpopRetry(() =>
		agent.com.atproto.repo.deleteRecord({
			repo,
			collection,
			rkey
		})
	)
}

/**
 * List all tracks for a DID (all pages)
 */
export async function listAllTracksByDid(did: string): Promise<Track[]> {
	const allTracks: Track[] = []
	let cursor: string | undefined

	do {
		const result = await listTracksByDid(did, {cursor, limit: 100})
		allTracks.push(...result.tracks)
		cursor = result.cursor
	} while (cursor)

	return allTracks
}

/**
 * Delete all tracks for current user
 */
export async function deleteAllTracks(
	onProgress?: (current: number, total: number) => void,
	onError?: (error: string) => void
): Promise<number> {
	const agent = assertAgent()
	const myDid = agent.accountDid!

	// Get all tracks
	const tracks = await listAllTracksByDid(myDid)
	const total = tracks.length

	if (total === 0) return 0

	let deleted = 0

	// Delete in batches
	for (const track of tracks) {
		try {
			await deleteTrackByUri(track.uri)
			deleted++
			onProgress?.(deleted, total)
		} catch (error) {
			const msg = String((error as Error)?.message || error)
			onError?.(`Failed to delete track ${track.title}: ${msg}`)
		}
	}

	return deleted
}

/**
 * Parse AT URI into components
 */
function parseAtUri(uri: string): {repo: string; collection: string; rkey: string} {
	if (!uri) {
		throw new Error('URI is required for parseAtUri')
	}
	const parts = uri.replace('at://', '').split('/')
	if (parts.length < 3) {
		throw new Error(`Invalid AT URI format: ${uri}. Expected format: at://repo/collection/rkey`)
	}
	return {
		repo: parts[0],
		collection: parts[1],
		rkey: parts[2]
	}
}
