/**
 * AT Protocol Favorites Service
 * Handles com.radio4000.favorite records (user follows/favorites)
 */

import {assertAgent, withDpopRetry, fetchWithAgentFallback} from '../../utils/atproto-client'
import type {
	R4FavoriteRecord,
	ListR4FavoriteOptions,
	ListR4FavoriteResult,
	AtProtoRecord
} from '../../types'

export const R4_FAVORITE_COLLECTION = 'com.radio4000.favorite'

/**
 * Convert DID to valid rkey for favorite records
 */
function favoriteRkey(subjectDid: string): string {
	return subjectDid.replace(/[^a-z0-9._-]/gi, '-').toLowerCase()
}

/**
 * List favorites for a given DID
 */
export async function listR4FavoritesByDid(
	did: string,
	{cursor, limit = 50}: ListR4FavoriteOptions = {}
): Promise<ListR4FavoriteResult> {
	const res = await fetchWithAgentFallback(
		(agent) =>
			agent.com.atproto.repo.listRecords({
				repo: did,
				collection: R4_FAVORITE_COLLECTION,
				cursor,
				limit,
				reverse: true
			}),
		{did, useAuthForOwn: true}
	)

	const records = (res.data?.records || [])
		.map((r: AtProtoRecord) => ({
			uri: r.uri,
			cid: r.cid,
			rkey: r.uri?.split('/').pop(),
			subject: r.value?.subject as string,
			createdAt: r.value?.createdAt as string | undefined
		}))
		.filter(
			(rec) => typeof rec.subject === 'string' && rec.subject.startsWith('did:')
		) as R4FavoriteRecord[]

	// Deduplicate by subject
	const seen = new Set<string>()
	const unique = records.filter((rec) => {
		if (!rec.subject) return false
		if (seen.has(rec.subject)) return false
		seen.add(rec.subject)
		return true
	})

	return {favorites: unique, cursor: res.data?.cursor}
}

/**
 * Create a favorite record
 */
export async function createR4Favorite(subjectDid: string) {
	const agent = assertAgent()
	const repo = agent.accountDid!
	const rkey = favoriteRkey(subjectDid)
	const record = {
		$type: R4_FAVORITE_COLLECTION,
		subject: subjectDid,
		createdAt: new Date().toISOString()
	}

	try {
		return await withDpopRetry(() =>
			agent.com.atproto.repo.putRecord({
				repo,
				collection: R4_FAVORITE_COLLECTION,
				rkey,
				record
			})
		)
	} catch (err) {
		const msg = String((err as Error)?.message || err)
		if (msg.includes('repo:com.radio4000.favorite?action=create')) {
			const e2 = new Error('Missing permission. Open Settings to re-consent.')
			Object.assign(e2, {code: 'scope-missing'})
			throw e2
		}
		throw err
	}
}

/**
 * Find the URI of a favorite record for a given subject
 */
export async function findR4FavoriteUri(subjectDid: string): Promise<string | null> {
	const agent = assertAgent()
	const me = agent.accountDid!

	const res = await fetchWithAgentFallback(
		(agent) =>
			agent.com.atproto.repo.listRecords({
				repo: me,
				collection: R4_FAVORITE_COLLECTION,
				limit: 100
			}),
		{did: me, useAuthForOwn: true}
	)

	const match = (res.data?.records || []).find(
		(r: AtProtoRecord) => r.value?.subject === subjectDid
	)
	return match?.uri || null
}

/**
 * Delete a favorite record
 */
export async function deleteR4Favorite(subjectDid: string): Promise<void> {
	const agent = assertAgent()
	const repo = agent.accountDid!
	const rkey = favoriteRkey(subjectDid)

	try {
		await withDpopRetry(() =>
			agent.com.atproto.repo.deleteRecord({
				repo,
				collection: R4_FAVORITE_COLLECTION,
				rkey
			})
		)
	} catch (err) {
		// If record doesn't exist, that's fine
		const msg = String((err as Error)?.message || err)
		if (!msg.includes('RecordNotFound')) {
			throw err
		}
	}
}

/**
 * Check if a user has any R4 records (tracks or favorites)
 */
export async function hasR4Records(did: string): Promise<boolean> {
	try {
		const res = await fetchWithAgentFallback(
			(agent) =>
				agent.com.atproto.repo.listRecords({
					repo: did,
					collection: R4_FAVORITE_COLLECTION,
					limit: 1
				}),
			{did, useAuthForOwn: false}
		)

		if (res.data?.records && res.data.records.length > 0) {
			return true
		}
	} catch {
		// Ignore errors, just means no records
	}

	return false
}

/**
 * Check if a specific follower has favorited a subject
 */
export async function hasR4FavoriteRecord(
	followerDid: string,
	subjectDid: string
): Promise<boolean> {
	try {
		const res = await fetchWithAgentFallback(
			(agent) =>
				agent.com.atproto.repo.listRecords({
					repo: followerDid,
					collection: R4_FAVORITE_COLLECTION,
					limit: 100
				}),
			{did: followerDid, useAuthForOwn: false}
		)

		const records = res.data?.records || []
		if (records.some((r: AtProtoRecord) => r.value?.subject === subjectDid)) {
			return true
		}
	} catch {
		// Ignore errors
	}

	return false
}
