/**
 * AT Protocol Social Service
 * Handles social graph operations (follow/unfollow) and actor profiles
 */

import {assertAgent, getPublicAgent} from '../../utils/atproto-client'
import type {AtProtoRecord, Relationship, Actor} from '../../types/index'

/**
 * Follow an actor by DID
 */
export async function followActor(subjectDid: string) {
	const agent = assertAgent()
	return agent.follow(subjectDid)
}

/**
 * Unfollow an actor using the follow record URI
 */
export async function unfollowActor(followUri: string) {
	const agent = assertAgent()
	return agent.deleteFollow(followUri)
}

/**
 * Find existing follow record URI for a subject DID
 * Returns the follow record URI or null if not following
 */
export async function findFollowUri(subjectDid: string): Promise<string | null> {
	const agent = assertAgent()

	// First try using getRelationships API (faster)
	try {
		const rel = await agent.app.bsky.graph.getRelationships({
			actor: agent.accountDid!,
			others: [subjectDid]
		})
		const entry = rel.data?.relationships?.find(
			(r) =>
				(r as Relationship).did === subjectDid &&
				(r as Relationship).following &&
				typeof (r as Relationship).following === 'string'
		) as Relationship | undefined

		if (entry && typeof entry.following === 'string') {
			return entry.following
		}
	} catch {
		// Fall through to repo scan
	}

	// Fallback: scan follow records directly
	const me = agent.accountDid!
	const res = await agent.com.atproto.repo.listRecords({
		repo: me,
		collection: 'app.bsky.graph.follow',
		limit: 100,
		reverse: true
	})

	const rec = (res.data?.records || []).find((r: AtProtoRecord) => r.value?.subject === subjectDid)
	return rec?.uri || null
}

/**
 * Search for actors by query string
 */
export async function searchActors(query: string, {limit = 25} = {}): Promise<Actor[]> {
	const agent = getPublicAgent()
	const res = await agent.searchActors({q: query, limit})
	return res.data?.actors || []
}

/**
 * Get the handle for a given DID
 */
export async function getHandleByDid(did: string): Promise<string | null> {
	// Try public appview first
	try {
		const res = await getPublicAgent().app.bsky.actor.getProfile({actor: did})
		return res.data?.handle || null
	} catch (e) {
		// Try authenticated agent as fallback
		try {
			const auth = assertAgent()
			const res = await auth.app.bsky.actor.getProfile({actor: did})
			return res.data?.handle || null
		} catch (_) {
			return null
		}
	}
}

/**
 * Get profile for a single actor (by DID or handle)
 */
export async function getProfile(actor: string) {
	try {
		const res = await getPublicAgent().app.bsky.actor.getProfile({actor})
		return res.data || null
	} catch (e) {
		try {
			const auth = assertAgent()
			const res = await auth.app.bsky.actor.getProfile({actor})
			return res.data || null
		} catch (_) {
			return null
		}
	}
}

/**
 * Get profiles for multiple actors in batch
 * Returns a map of DID -> profile
 */
export async function getProfiles(actors: string[]): Promise<Map<string, unknown>> {
	const map = new Map<string, unknown>()
	if (!actors.length) return map
	const unique = Array.from(new Set(actors.filter(Boolean)))
	const agent = getPublicAgent()

	// Batch in chunks of 25 to respect API limits
	const chunkSize = 25
	for (let i = 0; i < unique.length; i += chunkSize) {
		const batch = unique.slice(i, i + chunkSize)
		try {
			const res = await agent.app.bsky.actor.getProfiles({actors: batch})
			const profiles = res.data?.profiles || []
			for (const profile of profiles) {
				map.set(profile.did, profile)
			}
		} catch (e) {
			// If batch fails, try individually
			for (const actor of batch) {
				try {
					const single = await agent.app.bsky.actor.getProfile({actor})
					if (single?.data) map.set(actor, single.data)
				} catch {}
			}
		}
	}
	return map
}
