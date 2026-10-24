/**
 * Track Normalizer Utility
 * Handles inconsistent field naming between camelCase and snake_case
 * Canonical format is snake_case to match Radio4000.com schema
 */

export interface RawTrack {
	uri?: string
	cid?: string
	rkey?: string
	url?: string
	title?: string
	description?: string
	discogsUrl?: string // Legacy camelCase
	discogs_url?: string // Canonical snake_case
	r4SupabaseId?: string
	r4_supabase_id?: string
	createdAt?: string // Legacy camelCase
	created_at?: string // Canonical snake_case
	updatedAt?: string // Legacy camelCase
	updated_at?: string // Canonical snake_case
	authorDid?: string
	author_did?: string
	[key: string]: unknown
}

export interface NormalizedTrack {
	uri: string
	cid?: string
	rkey?: string
	url: string
	title: string
	description?: string
	discogs_url?: string // Canonical snake_case to match Radio4000
	r4SupabaseId?: string
	created_at?: string // Canonical snake_case to match Radio4000
	updated_at?: string // Canonical snake_case to match Radio4000
	authorDid?: string
}

/**
 * Normalize track fields to consistent snake_case naming
 * Handles both camelCase (legacy) and snake_case inputs
 * Output uses snake_case to match Radio4000.com schema
 */
export function normalizeTrack(track: RawTrack): NormalizedTrack {
	return {
		uri: track.uri || '',
		cid: track.cid,
		rkey: track.rkey,
		url: track.url || '',
		title: track.title || '',
		description: track.description,
		discogs_url: track.discogs_url ?? track.discogsUrl, // Prefer snake_case
		r4SupabaseId: track.r4SupabaseId ?? track.r4_supabase_id,
		created_at: track.created_at ?? track.createdAt, // Prefer snake_case
		updated_at: track.updated_at ?? track.updatedAt, // Prefer snake_case
		authorDid: track.authorDid ?? track.author_did
	}
}

/**
 * Normalize an array of tracks
 */
export function normalizeTracks(tracks: RawTrack[]): NormalizedTrack[] {
	return tracks.map(normalizeTrack)
}

/**
 * Check if track has required fields
 */
export function isValidTrack(track: Partial<NormalizedTrack>): track is NormalizedTrack {
	return !!(track.uri && track.url && track.title)
}

/**
 * Filter out invalid tracks from an array
 */
export function filterValidTracks(tracks: Partial<NormalizedTrack>[]): NormalizedTrack[] {
	return tracks.filter(isValidTrack)
}
