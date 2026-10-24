/**
 * AT Protocol Client Utilities
 * Reusable utilities for working with AT Protocol agents
 */

import {Agent} from '@atproto/api'
import {bskyOAuth} from '../services/bsky-oauth'
import {isDpopNonceError} from './errors'

// Public agent singleton
let publicAgent: Agent | undefined

/**
 * Get or create public agent for AppView access
 */
export function getPublicAgent(): Agent {
	if (!publicAgent) {
		publicAgent = new Agent({service: 'https://api.bsky.app'})
	}
	return publicAgent
}

/**
 * Assert that user is authenticated and return agent
 * @throws Error if not authenticated
 */
export function assertAgent(): Agent {
	if (!bskyOAuth.agent) {
		throw new Error('Not authenticated')
	}
	return bskyOAuth.agent
}

/**
 * Check if authenticated
 */
export function isAuthenticated(): boolean {
	return !!bskyOAuth.agent && !!bskyOAuth.session
}

/**
 * Get current user's DID
 */
export async function getMyDid(): Promise<string> {
	const agent = assertAgent()
	return agent.did!
}

// PDS resolution cache
const pdsCache = new Map<string, string>()

/**
 * Resolve a DID to its PDS endpoint via PLC directory
 * Results are cached for performance
 */
export async function getPdsForDid(did: string): Promise<string> {
	if (pdsCache.has(did)) {
		return pdsCache.get(did)!
	}

	const url = `https://plc.directory/${encodeURIComponent(did)}`
	const res = await fetch(url, {headers: {accept: 'application/json'}})

	if (!res.ok) {
		throw new Error(`Failed to resolve PDS for ${did}`)
	}

	const doc = await res.json()
	const services = doc?.service || []
	const pds = services.find(
		(s: Record<string, unknown>) =>
			(s?.id === '#atproto_pds' || /atproto.*pds/i.test(String(s?.type))) &&
			(s?.serviceEndpoint || s?.endpoint)
	)

	const endpoint = (pds?.serviceEndpoint || pds?.endpoint) as string | undefined

	if (!endpoint) {
		throw new Error(`No PDS endpoint in DID doc for ${did}`)
	}

	pdsCache.set(did, endpoint)
	return endpoint
}

/**
 * Retry a function with DPoP nonce handling
 * AT Protocol uses DPoP nonces which may need to be refreshed
 */
export async function withDpopRetry<T>(fn: () => Promise<T>): Promise<T> {
	try {
		return await fn()
	} catch (e) {
		if (isDpopNonceError(e)) {
			// Retry once after nonce update
			try {
				return await fn()
			} catch (e2) {
				throw e2
			}
		}
		throw e
	}
}

/**
 * Agent fallback strategy options
 */
export interface AgentFallbackOptions {
	/** DID of the target user */
	did: string
	/** Use authenticated agent if accessing own data */
	useAuthForOwn?: boolean
}

/**
 * Fetch with agent fallback strategy
 *
 * Tries multiple agents in order:
 * 1. Public AppView (fast, works for public data)
 * 2. Direct PDS access (works when AppView doesn't have data)
 * 3. Authenticated agent (works for private data or when PDS requires auth)
 *
 * @param fetchFn Function that performs the fetch using the provided agent
 * @param options Fallback options
 * @returns Result from the fetch function
 */
export async function fetchWithAgentFallback<T>(
	fetchFn: (agent: Agent) => Promise<T>,
	options: AgentFallbackOptions
): Promise<T> {
	const {did, useAuthForOwn = true} = options

	// Check if we should use authenticated agent for own data
	let useAuth = false
	let myAgent: Agent | undefined

	try {
		myAgent = assertAgent()
		useAuth = useAuthForOwn && (myAgent.accountDid === did || myAgent.did === did)
	} catch {
		// Not authenticated, will use public agent
	}

	// Try primary agent (authenticated for own data, public for others)
	try {
		const primaryAgent = useAuth ? myAgent! : getPublicAgent()
		return await fetchFn(primaryAgent)
	} catch (primaryError) {
		// If we already tried auth agent, no fallback needed
		if (useAuth) {
			throw primaryError
		}

		// Fallback 1: Try direct PDS access via PLC resolution
		try {
			const pds = await getPdsForDid(did)
			const pdsAgent = new Agent({service: pds})
			return await fetchFn(pdsAgent)
		} catch (pdsError) {
			// Fallback 2: Try authenticated agent as last resort
			// (may work if user's PDS can proxy or if they have special access)
			try {
				const authAgent = assertAgent()
				return await fetchFn(authAgent)
			} catch {
				// Throw the PDS error since it's more informative than auth error
				throw pdsError
			}
		}
	}
}

/**
 * Retry with exponential backoff
 * @param fn Function to retry
 * @param maxRetries Maximum number of retries
 * @param delayMs Initial delay in milliseconds
 * @param backoffMultiplier Multiplier for exponential backoff
 * @returns Result from the function
 */
export async function withRetry<T>(
	fn: () => Promise<T>,
	maxRetries = 3,
	delayMs = 1000,
	backoffMultiplier = 2
): Promise<T> {
	let lastError: unknown

	for (let attempt = 0; attempt <= maxRetries; attempt++) {
		try {
			return await fn()
		} catch (error) {
			lastError = error

			// Don't retry on last attempt
			if (attempt === maxRetries) {
				break
			}

			// Calculate delay with exponential backoff
			const delay = delayMs * backoffMultiplier ** attempt

			// Wait before retrying
			await new Promise((resolve) => setTimeout(resolve, delay))
		}
	}

	throw lastError
}

/**
 * Resolve handle to DID
 */
export async function resolveHandle(handle: string): Promise<string | undefined> {
	const agent = getPublicAgent()
	const res = await agent.resolveHandle({handle})
	return res.data?.did
}
