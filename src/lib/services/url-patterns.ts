// URL parsing utilities for music/video providers using URLPattern API
// Returns a normalized representation for supported providers or null if unsupported.

type Provider = 'youtube' | 'soundcloud' | 'vimeo' | 'bandcamp' | 'file'

interface TrackMeta {
	provider: Provider
	id: string
	url: string
}

interface EmbedOptions {
	autoplay?: boolean
}

export function parseTrackUrl(input: string): TrackMeta | null {
	try {
		const url = new URL(input)
		const hasURLPattern = typeof (globalThis as any).URLPattern !== 'undefined'

		if (hasURLPattern) {
			const URLPattern = (globalThis as any).URLPattern
			const ytShort = new URLPattern({protocol: 'https:', hostname: 'youtu.be', pathname: '/:id'})
			const ytWatch = new URLPattern({
				protocol: 'https:',
				hostname: 'www.youtube.com',
				pathname: '/watch'
			})
			const scTrack = new URLPattern({
				protocol: 'https:',
				hostname: 'soundcloud.com',
				pathname: '/:user/:slug'
			})
			const vimeo = new URLPattern({protocol: 'https:', hostname: 'vimeo.com', pathname: '/:id'})
			const bandcamp = new URLPattern({
				protocol: 'https:',
				hostname: ':subdomain.bandcamp.com',
				pathname: '/track/:slug'
			})
			const file = new URLPattern({protocol: 'https:', hostname: '*', pathname: '/*.:ext'})

			if (ytShort.test(url)) {
				const id = url.pathname.slice(1)
				return {provider: 'youtube', id, url: `https://www.youtube.com/watch?v=${id}`}
			}
			if (ytWatch.test(url)) {
				const id = url.searchParams.get('v')
				if (id) return {provider: 'youtube', id, url: `https://www.youtube.com/watch?v=${id}`}
			}
			if (scTrack.test(url)) {
				const m = scTrack.exec(url)
				const user = m!.pathname.groups.user
				const slug = m!.pathname.groups.slug
				return {
					provider: 'soundcloud',
					id: `${user}/${slug}`,
					url: `https://soundcloud.com/${user}/${slug}`
				}
			}
			if (vimeo.test(url)) {
				const id = vimeo.exec(url)!.pathname.groups.id
				return {provider: 'vimeo', id, url: `https://vimeo.com/${id}`}
			}
			if (bandcamp.test(url)) {
				const m = bandcamp.exec(url)!
				const sub = m.hostname.groups.subdomain
				const slug = m.pathname.groups.slug
				return {
					provider: 'bandcamp',
					id: `${sub}/track/${slug}`,
					url: `https://${sub}.bandcamp.com/track/${slug}`
				}
			}
			if (file.test(url)) {
				const ext = file.exec(url)!.pathname.groups.ext?.toLowerCase()
				const supported = ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'mp4', 'webm']
				if (ext && supported.includes(ext)) return {provider: 'file', id: url.href, url: url.href}
			}
		} else {
			const host = url.hostname
			const path = url.pathname
			const sp = url.searchParams
			// YouTube
			if (host.endsWith('youtube.com') && path === '/watch') {
				const id = sp.get('v')
				if (id) return {provider: 'youtube', id, url: `https://www.youtube.com/watch?v=${id}`}
			}
			if (host === 'youtu.be' && path.length > 1) {
				const id = path.slice(1)
				return {provider: 'youtube', id, url: `https://www.youtube.com/watch?v=${id}`}
			}
			// SoundCloud
			if (host.endsWith('soundcloud.com')) {
				const parts = path.split('/').filter(Boolean)
				if (parts.length >= 2) {
					const [user, slug] = parts
					return {
						provider: 'soundcloud',
						id: `${user}/${slug}`,
						url: `https://soundcloud.com/${user}/${slug}`
					}
				}
			}
			// Vimeo
			if (host.endsWith('vimeo.com')) {
				const m = path.match(/^\/(\d+)/)
				if (m) return {provider: 'vimeo', id: m[1], url: `https://vimeo.com/${m[1]}`}
			}
			// Bandcamp
			if (host.endsWith('.bandcamp.com') && path.startsWith('/track/')) {
				const sub = host.split('.bandcamp.com')[0]
				const slug = path.replace('/track/', '')
				return {
					provider: 'bandcamp',
					id: `${sub}/track/${slug}`,
					url: `https://${sub}.bandcamp.com/track/${slug}`
				}
			}
			// Direct file
			const ext = path.split('.').pop()?.toLowerCase()
			const supported = ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'mp4', 'webm']
			if (ext && supported.includes(ext)) return {provider: 'file', id: url.href, url: url.href}
		}

		return null
	} catch (_) {
		return null
	}
}

export function extractFirstTrackUrl(text: string): TrackMeta | null {
	if (!text) return null
	// naive URL extraction; rely on parser to validate
	const m = text.match(/https?:\/\/\S+/)
	if (!m) return null
	return parseTrackUrl(m[0])
}

// Build provider embed URL with autoplay control
export function buildEmbedUrl(
	meta: TrackMeta | null,
	{autoplay = true}: EmbedOptions = {}
): string | null {
	if (!meta) return null
	const ap = autoplay ? 1 : 0
	if (meta.provider === 'youtube' && meta.id) {
		const origin = encodeURIComponent(window.location.origin)
		return `https://www.youtube.com/embed/${meta.id}?autoplay=${ap}&enablejsapi=1&origin=${origin}`
	}
	if (meta.provider === 'vimeo' && meta.id) {
		return `https://player.vimeo.com/video/${meta.id}?autoplay=${ap}&api=1&player_id=r4player`
	}
	if (meta.provider === 'soundcloud') {
		const url = encodeURIComponent(meta.url)
		return `https://w.soundcloud.com/player/?url=${url}&auto_play=${autoplay ? 'true' : 'false'}&api=true&player_id=r4player`
	}
	return null
}
