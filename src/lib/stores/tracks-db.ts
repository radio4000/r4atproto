import {createCollection, localStorageCollectionOptions} from '@tanstack/svelte-db'
import {
	listTracksByDid,
	createTrack as apiCreateTrack,
	updateTrackByUri as apiUpdateTrack,
	deleteTrackByUri as apiDeleteTrack
} from '#lib/services/r4-service.js'
import type {Track} from '#lib/types/index.js'
import {writable, get} from 'svelte/store'

export type {Track}

// Store to manage pagination state per DID - using Svelte store for reactivity
// Load from localStorage on initialization
function loadPaginationState(): Map<string, {cursor?: string; hasMore: boolean; loading: boolean}> {
	if (typeof window === 'undefined') return new Map()
	try {
		const stored = localStorage.getItem('r4atproto-pagination-state')
		if (stored) {
			const parsed = JSON.parse(stored)
			return new Map(Object.entries(parsed))
		}
	} catch (e) {
		console.warn('[TracksDB] Failed to load pagination state from localStorage:', e)
	}
	return new Map()
}

const paginationStateMap = writable(loadPaginationState())

// Save to localStorage whenever it changes
paginationStateMap.subscribe((map) => {
	if (typeof window === 'undefined') return
	try {
		const obj = Object.fromEntries(map)
		localStorage.setItem('r4atproto-pagination-state', JSON.stringify(obj))
	} catch (e) {
		console.warn('[TracksDB] Failed to save pagination state to localStorage:', e)
	}
})

// Create a collection for tracks using localStorage persistence
// This persists tracks across page refreshes and supports cross-tab sync
// Note: Indexes will be added when TanStack DB API stabilizes
export const tracksCollection = createCollection(
	localStorageCollectionOptions<Track, string>({
		getKey: (item: Track) => item.uri,
		storageKey: 'r4atproto-tracks'
	})
)

/**
 * Load tracks for a specific DID
 * This will fetch tracks and add them to the collection
 */
export async function loadTracksForDid(
	did: string,
	options?: {cursor?: string; limit?: number; reset?: boolean; forceRefresh?: boolean}
) {
	// Prevent concurrent loading for the same DID
	const currentMap = get(paginationStateMap)
	const state = currentMap.get(did)
	if (state?.loading) {
		return {tracks: [], cursor: undefined}
	}

	// Mark as loading
	paginationStateMap.update((map) => {
		map.set(did, {...state, cursor: state?.cursor, hasMore: state?.hasMore ?? false, loading: true})
		return map
	})

	try {
		// Reset if requested (clears existing tracks for this DID)
		if (options?.reset) {
			resetTracksForDid(did)
		}

		// If not resetting and we already have tracks, check if we need to load at all
		// Skip this check if forceRefresh is true
		if (!options?.reset && !options?.cursor && !options?.forceRefresh) {
			const existingTracks = tracksCollection.toArray.filter((t) => t.authorDid === did)
			if (existingTracks.length > 0) {
				// Already have tracks, restore pagination state and skip loading
				const existingState = get(paginationStateMap).get(did)
				paginationStateMap.update((map) => {
					map.set(did, {
						cursor: existingState?.cursor,
						hasMore: existingState?.hasMore ?? false,
						loading: false
					})
					return map
				})
				return {tracks: existingTracks, cursor: existingState?.cursor}
			}
		}

		// Load tracks in chronological order (oldest first by rkey)
		// For refresh, use reverse=true to get newest tracks
		// Then sort client-side by created_at for display
		const result = await listTracksByDid(did, {
			...options,
			reverse: options?.forceRefresh ? true : false
		})

		// Add tracks to collection with authorDid
		result.tracks.forEach((track) => {
			const trackWithDid = {...track, authorDid: did}

			// Check if track already exists, if so update it, otherwise insert
			const existing = tracksCollection.get(track.uri)
			if (existing) {
				tracksCollection.update(track.uri, (draft) => {
					Object.assign(draft, trackWithDid)
				})
			} else {
				tracksCollection.insert(trackWithDid)
			}
		})

		// Update pagination state
		// If this is a refresh (forceRefresh=true), don't update hasMore/cursor
		// to avoid showing "load more" button when we're just checking for new tracks
		paginationStateMap.update((map) => {
			const existingState = map.get(did)
			if (options?.forceRefresh) {
				// For refresh, only update loading state, keep existing cursor/hasMore
				map.set(did, {
					cursor: existingState?.cursor,
					hasMore: existingState?.hasMore ?? false,
					loading: false
				})
			} else {
				// For normal loading, update cursor and hasMore
				map.set(did, {
					cursor: result.cursor,
					hasMore: !!result.cursor,
					loading: false
				})
			}
			return map
		})

		return result
	} catch (error) {
		console.error('Failed to load tracks for DID:', did, error)
		paginationStateMap.update((map) => {
			map.set(did, {
				...state,
				cursor: state?.cursor,
				hasMore: state?.hasMore ?? false,
				loading: false
			})
			return map
		})
		throw error
	}
}

/**
 * Load more tracks for a DID (pagination)
 */
export async function loadMoreTracksForDid(did: string) {
	const state = get(paginationStateMap).get(did)
	if (!state?.cursor) {
		return {tracks: [], cursor: undefined}
	}

	return loadTracksForDid(did, {cursor: state.cursor})
}

/**
 * Get pagination state for a DID (returns a derived store for reactivity)
 */
export function getPaginationState(did: string) {
	return {
		subscribe: (fn: (value: {cursor?: string; hasMore: boolean; loading: boolean}) => void) => {
			return paginationStateMap.subscribe((map) => {
				fn(map.get(did) || {cursor: undefined, hasMore: false, loading: false})
			})
		}
	}
}

/**
 * Reset tracks for a DID (useful when refreshing)
 */
export function resetTracksForDid(did: string) {
	// Get all tracks for this DID and remove them
	const allTracks = tracksCollection.toArray
	const tracksToRemove = allTracks.filter((track) => track.authorDid === did)

	tracksToRemove.forEach((track) => {
		tracksCollection.delete(track.uri)
	})

	// Reset pagination state
	paginationStateMap.update((map) => {
		map.delete(did)
		return map
	})
}

/**
 * Update a track (makes API call then updates collection)
 */
export async function updateTrack(uri: string, changes: Partial<Track>) {
	const track = tracksCollection.get(uri)
	if (!track) {
		throw new Error('Track not found in collection')
	}

	// Optimistic update
	const originalTrack = {...track}
	tracksCollection.update(uri, (draft) => {
		Object.assign(draft, changes)
	})

	try {
		// Make API call
		await apiUpdateTrack(uri, changes)
	} catch (error) {
		// Rollback on error
		tracksCollection.update(uri, (draft) => {
			Object.assign(draft, originalTrack)
		})
		throw error
	}
}

/**
 * Delete a track (makes API call then removes from collection)
 */
export async function removeTrack(uri: string) {
	const track = tracksCollection.get(uri)
	if (!track) {
		return // Already deleted
	}

	// Optimistic delete
	const originalTrack = {...track}
	tracksCollection.delete(uri)

	try {
		// Make API call
		await apiDeleteTrack(uri)
	} catch (error) {
		// Rollback on error
		tracksCollection.insert(originalTrack)
		throw error
	}
}

/**
 * Create a new track (makes API call then adds to collection)
 */
export async function createTrack(
	track: Omit<Track, 'uri' | 'cid' | 'rkey'> & {authorDid: string}
) {
	try {
		// Make API call first
		const result = await apiCreateTrack({
			url: track.url,
			title: track.title,
			description: track.description,
			discogs_url: track.discogs_url
		})

		// Add to collection
		const resultData = result as unknown as {uri: string; cid: string}

		// Extract rkey from URI (at://did/collection/rkey)
		const rkey = resultData.uri?.split('/').pop()

		const newTrack: Track = {
			uri: resultData.uri,
			cid: resultData.cid,
			rkey,
			url: track.url,
			title: track.title,
			description: track.description,
			discogs_url: track.discogs_url,
			authorDid: track.authorDid,
			created_at: new Date().toISOString() // Set current timestamp
		}
		tracksCollection.insert(newTrack)

		return newTrack
	} catch (error) {
		console.error('Failed to create track:', error)
		throw error
	}
}

/**
 * Get all tracks for a specific DID from the collection
 */
export function getTracksForDid(did: string): Track[] {
	return tracksCollection.toArray.filter((track) => track.authorDid === did)
}
