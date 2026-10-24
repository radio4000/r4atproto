type Provider = 'youtube' | 'soundcloud' | 'vimeo'

export const PROVIDERS: Record<string, Provider> = {
	'www.youtube.com': 'youtube',
	'm.youtube.com': 'youtube',
	'youtube.com': 'youtube',
	'youtu.be': 'youtube',
	'soundcloud.com': 'soundcloud',
	'vimeo.com': 'vimeo'
}

const OEMBED_PROVIDERS: Record<Provider, string> = {
	soundcloud: 'https://soundcloud.com/oembed?format=json&url=',
	youtube: 'https://www.youtube.com/oembed?url=',
	vimeo: 'https://vimeo.com/api/oembed.json?url='
}

const getProvider = (hostname: string): Provider | undefined => PROVIDERS[hostname]
const getProviderOEmbedUrl = (provider: Provider, urlText: string): string =>
	`${OEMBED_PROVIDERS[provider]}${urlText}`

export const getOEmbedUrl = (urlAddress: string): string | undefined => {
	try {
		const url = new URL(urlAddress)
		const provider = getProvider(url.hostname)
		if (provider) {
			return getProviderOEmbedUrl(provider, urlAddress)
		}
	} catch (_) {}
}

interface OEmbedData {
	error?: string
	[key: string]: any
}

export const fetchOEmbed = async (mediaProviderUrl: string): Promise<OEmbedData> => {
	const oEmbedUrl = getOEmbedUrl(mediaProviderUrl)
	if (!oEmbedUrl) return {error: 'Error fetching oembed for this url'}
	const res = await fetch(oEmbedUrl)
	return res.json()
}
