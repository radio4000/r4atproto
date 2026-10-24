/**
 * AT Protocol Profile Service
 * Handles com.radio4000.profile records (user theme/profile settings)
 */

import {Agent} from '@atproto/api'
import {assertAgent, getPublicAgent, getPdsForDid, withDpopRetry} from '../../utils/atproto-client'
import type {R4ProfileRecord} from '../../types'

export const R4_PROFILE_COLLECTION = 'com.radio4000.profile'
export const PROFILE_RKEY = 'self'

/**
 * Get profile settings for a given DID
 */
export async function getR4Profile(did: string): Promise<R4ProfileRecord | null> {
	async function fetchWith(agent: Agent) {
		return agent.com.atproto.repo.getRecord({
			repo: did,
			collection: R4_PROFILE_COLLECTION,
			rkey: PROFILE_RKEY
		})
	}

	// Try public agent first
	try {
		const res = await fetchWith(getPublicAgent())
		const value = res.data?.value as unknown as R4ProfileRecord | undefined
		if (!value) return null
		return {
			uri: res.data?.uri,
			cid: res.data?.cid,
			mode: value.mode || 'auto',
			lightBackground: value.lightBackground || '0 0% 100%',
			lightForeground: value.lightForeground || '240 10% 3.9%',
			lightAccent: value.lightAccent || '262 83% 58%',
			darkBackground: value.darkBackground || '240 10% 3.9%',
			darkForeground: value.darkForeground || '0 0% 98%',
			darkAccent: value.darkAccent || '262 83% 58%',
			createdAt: value.createdAt,
			updatedAt: value.updatedAt
		}
	} catch (e) {
		// Try with PDS fallback (even for RecordNotFound)
		try {
			const pds = await getPdsForDid(did)
			const remote = new Agent({service: pds})
			const res = await fetchWith(remote)
			const value = res.data?.value as unknown as R4ProfileRecord | undefined
			if (!value) return null
			return {
				uri: res.data?.uri,
				cid: res.data?.cid,
				mode: value.mode || 'auto',
				lightBackground: value.lightBackground || '0 0% 100%',
				lightForeground: value.lightForeground || '240 10% 3.9%',
				lightAccent: value.lightAccent || '262 83% 58%',
				darkBackground: value.darkBackground || '240 10% 3.9%',
				darkForeground: value.darkForeground || '0 0% 98%',
				darkAccent: value.darkAccent || '262 83% 58%',
				createdAt: value.createdAt,
				updatedAt: value.updatedAt
			}
		} catch (e2) {
			// Still didn't find a profile — try with authenticated agent
			// (in case did is actually the user & we need auth)
			try {
				const my = assertAgent()
				const res = await fetchWith(my)
				const value = res.data?.value as unknown as R4ProfileRecord | undefined
				if (!value) return null
				return {
					uri: res.data?.uri,
					cid: res.data?.cid,
					mode: value.mode || 'auto',
					lightBackground: value.lightBackground || '0 0% 100%',
					lightForeground: value.lightForeground || '240 10% 3.9%',
					lightAccent: value.lightAccent || '262 83% 58%',
					darkBackground: value.darkBackground || '240 10% 3.9%',
					darkForeground: value.darkForeground || '0 0% 98%',
					darkAccent: value.darkAccent || '262 83% 58%',
					createdAt: value.createdAt,
					updatedAt: value.updatedAt
				}
			} catch (_) {
				return null
			}
		}
	}
}

/**
 * Set profile settings for the current user
 */
export async function setR4Profile(
	profile: Omit<R4ProfileRecord, 'uri' | 'cid' | 'createdAt' | 'updatedAt'>
) {
	const agent = assertAgent()
	const repo = agent.accountDid!

	// Check if profile exists
	let existing: Record<string, unknown> | null = null
	try {
		const res = await agent.com.atproto.repo.getRecord({
			repo,
			collection: R4_PROFILE_COLLECTION,
			rkey: PROFILE_RKEY
		})
		existing = res.data?.value
	} catch (err) {
		const msg = String((err as Error)?.message || err).toLowerCase()
		if (!msg.includes('record not found') && !msg.includes('could not locate record')) {
			// Some other error
			throw err
		}
	}

	const record = {
		$type: R4_PROFILE_COLLECTION,
		mode: profile.mode,
		lightBackground: profile.lightBackground,
		lightForeground: profile.lightForeground,
		lightAccent: profile.lightAccent,
		darkBackground: profile.darkBackground,
		darkForeground: profile.darkForeground,
		darkAccent: profile.darkAccent,
		createdAt: existing?.createdAt || new Date().toISOString(),
		updatedAt: new Date().toISOString()
	}

	try {
		// Use createRecord if no existing profile, putRecord if updating
		if (existing) {
			return await withDpopRetry(() =>
				agent.com.atproto.repo.putRecord({
					repo,
					collection: R4_PROFILE_COLLECTION,
					rkey: PROFILE_RKEY,
					record
				})
			)
		} else {
			return await withDpopRetry(() =>
				agent.com.atproto.repo.createRecord({
					repo,
					collection: R4_PROFILE_COLLECTION,
					rkey: PROFILE_RKEY,
					record
				})
			)
		}
	} catch (err) {
		const msg = String((err as Error)?.message || err)
		if (msg.includes('repo:com.radio4000.profile')) {
			const scoped = new Error(
				'Missing permission to save profile settings. Open Settings and re-consent to grant access.'
			) as Error & {code: string}
			scoped.code = 'scope-missing'
			throw scoped
		}
		throw err
	}
}
