// App URLs for radios and tracks. A radio lives at /@handle.
import {parseAtUri} from '#lib/atproto/repo.js'

export const channelHref = (slug: string) => `/@${slug}`

export const trackHref = (track: {id: string; slug: string}) =>
	`/@${track.slug}/tracks/${parseAtUri(track.id).rkey}`

/** A tag filter on a radio, e.g. /@alice.test?tags=dub */
export const channelTagHref = (slug: string, tag: string) =>
	`/@${slug}?tags=${encodeURIComponent(tag.replace(/^#/, ''))}`

/** A radio's full track list, optionally filtered (tags, mention, search) */
export const channelTracksHref = (
	slug: string,
	params?: URLSearchParams | Record<string, string>
) => {
	const query = new URLSearchParams(params).toString()
	return `/@${slug}/tracks${query ? `?${query}` : ''}`
}

export const searchHref = (q: string) => `/search?q=${encodeURIComponent(q)}`

/** Sign in, then come back to `redirect` */
export const authHref = (redirect?: string) =>
	redirect ? `/auth?redirect=${encodeURIComponent(redirect)}` : '/auth'
