// OAuth client metadata and scopes, derived from config/app.json and our lexicons.
import app from './config/app.json' with {type: 'json'}
import {BROADCAST, CHANNEL, FOLLOW, TRACK} from './lexicons'

/** Granular permissions: write our own collections, follow on Bluesky, upload channel images. */
export const OAUTH_SCOPE = [
	'atproto',
	...[TRACK, CHANNEL, FOLLOW, BROADCAST, 'app.bsky.graph.follow'].map((nsid) => `repo:${nsid}`),
	'blob:image/*'
].join(' ')

export const CLIENT_METADATA_PATH = '/client-metadata.json'

/** Production origin of the app */
export const APP_ORIGIN = `https://${app.domain}`

export function clientMetadata(origin: string) {
	return {
		client_id: `${origin}${CLIENT_METADATA_PATH}`,
		client_name: app.name,
		client_uri: origin,
		redirect_uris: [`${origin}/`],
		scope: OAUTH_SCOPE,
		grant_types: ['authorization_code', 'refresh_token'],
		response_types: ['code'],
		application_type: 'web',
		token_endpoint_auth_method: 'none',
		dpop_bound_access_tokens: true
	}
}
