import {createCollection, localOnlyCollectionOptions} from '@tanstack/svelte-db'
import {getProfile} from '#lib/services/r4-service.js'
import type {AppBskyActorDefs} from '@atproto/api'

// Use AT Protocol's ProfileViewDetailed type
export type Profile = AppBskyActorDefs.ProfileViewDetailed

// Create a collection for profiles using local-only storage
export const profilesCollection = createCollection(
	localOnlyCollectionOptions<Profile, string>({
		getKey: (profile: Profile) => profile.did
	})
)

// Track loading state per profile to prevent duplicate requests
const loadingProfiles = new Set<string>()

/**
 * Load a profile by handle or DID
 * Automatically caches in collection
 * Returns null if profile not found
 */
export async function loadProfile(handleOrDid: string): Promise<Profile | null> {
	if (!handleOrDid) return null

	// Normalize handle (remove @ if present)
	const normalized = handleOrDid.replace(/^@/, '')

	// Check if already loading
	if (loadingProfiles.has(normalized)) {
		// Wait a bit and check cache
		await new Promise((resolve) => setTimeout(resolve, 100))
		return getProfileFromCache(normalized)
	}

	// Check cache first
	const cached = getProfileFromCache(normalized)
	if (cached) {
		return cached
	}

	loadingProfiles.add(normalized)
	try {
		const profile = await getProfile(normalized)
		if (!profile) {
			return null
		}

		// Add to collection
		const existing = profilesCollection.get(profile.did)
		if (existing) {
			profilesCollection.update(profile.did, () => profile)
		} else {
			profilesCollection.insert(profile)
		}

		return profile
	} catch (error) {
		console.error('Failed to load profile:', normalized, error)
		return null
	} finally {
		loadingProfiles.delete(normalized)
	}
}

/**
 * Get profile from cache by DID or handle
 * Returns null if not found in cache
 */
export function getProfileFromCache(didOrHandle: string): Profile | null {
	if (!didOrHandle) return null

	const normalized = didOrHandle.replace(/^@/, '')

	// Try by DID first (exact match)
	const byDid = profilesCollection.get(normalized)
	if (byDid) return byDid

	// Try by handle (search all profiles)
	const allProfiles = profilesCollection.toArray
	return (
		allProfiles.find(
			(p) => p.handle === normalized || p.handle === `@${normalized}` || p.did === normalized
		) || null
	)
}

/**
 * Update a profile in the cache
 * Useful for optimistic updates (e.g., after updating own profile)
 */
export function updateProfileCache(did: string, updates: Partial<Profile>) {
	const existing = profilesCollection.get(did)
	if (existing) {
		profilesCollection.update(did, (draft) => {
			Object.assign(draft, updates)
		})
	}
}

/**
 * Clear a profile from cache
 * Useful when profile is deleted or on logout
 */
export function clearProfileCache(did: string) {
	if (did && profilesCollection.get(did)) {
		profilesCollection.delete(did)
	}
}

/**
 * Clear all profiles from cache
 * Useful on logout to remove sensitive data
 */
export function clearAllProfiles() {
	const allProfiles = profilesCollection.toArray
	allProfiles.forEach((profile) => {
		profilesCollection.delete(profile.did)
	})
}

/**
 * Preload multiple profiles at once
 * Useful for loading profiles for a list of tracks/posts
 */
export async function loadProfiles(handleOrDids: string[]): Promise<Map<string, Profile>> {
	const results = new Map<string, Profile>()

	// Load all profiles in parallel
	const promises = handleOrDids.map(async (id) => {
		const profile = await loadProfile(id)
		if (profile) {
			results.set(profile.did, profile)
			results.set(profile.handle, profile)
		}
	})

	await Promise.all(promises)
	return results
}
