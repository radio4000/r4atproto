/**
 * Discogs API Service
 * Consolidated service for interacting with Discogs API
 */

const DISCOGS_URL = 'discogs.com'
const DISCOGS_API_URL = 'api.discogs.com'

export const DiscogsResourceTypes = ['release', 'master'] as const
export const DiscogsSearchResourceTypes = [
	...DiscogsResourceTypes,
	'artist',
	'label',
	'all'
] as const

export type DiscogsResourceType = (typeof DiscogsResourceTypes)[number]
export type DiscogsSearchResourceType = (typeof DiscogsSearchResourceTypes)[number]

// Core interfaces
export interface DiscogsInfo {
	id: string
	type: DiscogsResourceType
}

export interface DiscogsTrack {
	title: string
	position: string
	duration?: string
}

export interface DiscogsVideo {
	uri: string
	title: string
}

export interface DiscogsArtist {
	name: string
}

export interface DiscogsLabel {
	name: string
}

export interface DiscogsResource {
	id: number
	title: string
	artists?: DiscogsArtist[]
	artists_sort?: string
	year?: number
	genres?: string[]
	styles?: string[]
	labels?: DiscogsLabel[]
	tracklist?: DiscogsTrack[]
	videos?: DiscogsVideo[]
	uri: string
	cover_image?: string
	thumb?: string
	errors?: string
}

export interface R4Track {
	title: string
	url: string
	discogs_url: string // Use snake_case to match Track type
	description: string
	source_track_uri?: string // URI of the original Radio4000 track that linked to this Discogs release
}

/**
 * Fetch a Discogs resource by ID and type
 */
export async function fetchDiscogs({id, type = 'release'}: DiscogsInfo): Promise<DiscogsResource> {
	const url = `https://${DISCOGS_API_URL}/${type}s/${id}`
	const response = await fetch(url)
	const data = await response.json()

	if (data.errors) {
		throw new Error(data.errors)
	}

	return data
}

/**
 * Parse a Discogs URL to extract resource info
 */
export function parseDiscogsUrl(url: string): DiscogsInfo | null {
	try {
		const discogsUrl = new URL(url)

		if (!discogsUrl.hostname.endsWith(DISCOGS_URL)) {
			return null
		}

		const pathParts = discogsUrl.pathname.slice(1).split('/')
		const type = pathParts.find((part) =>
			DiscogsResourceTypes.includes(part as DiscogsResourceType)
		) as DiscogsResourceType | undefined

		if (type) {
			const typeIndex = pathParts.indexOf(type)
			const id = pathParts[typeIndex + 1]?.split('-')[0]

			if (id) {
				return {id, type}
			}
		}
	} catch {
		return null
	}

	return null
}

/**
 * Extract tag suggestions from a Discogs resource
 * Returns array of suggested hashtags based on genres, styles, year, and labels
 */
export function extractSuggestions(resource: DiscogsResource): string[] {
	const {year = 0, genres = [], styles = [], labels = []} = resource
	const labelNames = labels?.map(({name}) => name) || []

	return [...genres, ...styles, year, ...labelNames]
		.filter(Boolean)
		.map((s) => s.toString().replace(/\s+/g, '-').toLowerCase())
}

/**
 * Convert a Discogs track to an R4 track format
 * Attempts to find matching video for the track
 * @param sourceTrackUri Optional URI of the Radio4000 track that linked to this Discogs release
 */
export function resourceTrackToR4Track(
	track: DiscogsTrack,
	resource: DiscogsResource,
	sourceTrackUri?: string
): R4Track {
	const video = resource.videos?.find((v) => {
		const videoTitle = v.title.toLowerCase().trim()
		const trackTitle = track.title.toLowerCase().trim()
		return videoTitle.includes(trackTitle)
	})

	// Get artist name from resource
	const artistName = resource.artists_sort || resource.artists?.map((a) => a.name).join(', ') || ''

	// Build title with artist and position
	// Format: "Artist - Position. Track" or "Artist - Track" (if no position)
	let title = track.title
	if (track.position) {
		title = `${track.position}. ${track.title}`
	}
	if (artistName) {
		title = `${artistName} - ${title}`
	}

	// Add indicator if no media URL is available
	const hasMedia = !!video?.uri
	const description = track.duration || (hasMedia ? '' : 'No media available')

	return {
		title,
		url: video?.uri || '',
		discogs_url: resource.uri, // Use snake_case to match Track type
		description,
		source_track_uri: sourceTrackUri
	}
}

/**
 * Build API URL for a Discogs resource
 */
export function buildApiUrl({type, id}: DiscogsInfo): string {
	return new URL(`${type}s/${id}`, `https://${DISCOGS_API_URL}`).href
}
