// OAuth client metadata and scopes, derived from config/app.json and our lexicons.
import app from './config/app.json' with {type: 'json'}
import {AUTH} from './lexicons'

type RepoPermission = {resource: string; collection: string[]; action?: string[]}

// The permission set schema, wherever the namespace puts it under /lexicons
const schemas = import.meta.glob<{id: string; defs: {main: {permissions: RepoPermission[]}}}>(
	'../../lexicons/**/*.json',
	{eager: true, import: 'default'}
)
const authSet = Object.values(schemas).find((schema) => schema.id === AUTH)
if (!authSet) throw new Error(`No lexicon for the permission set ${AUTH}`)

/** Raw scopes for a permission set's repo permissions, e.g. repo:radio.4000.channel?action=create&action=update */
export function repoScopes(permissions: RepoPermission[]): string[] {
	return permissions
		.filter((p) => p.resource === 'repo')
		.flatMap((p) =>
			p.collection.map((collection) => {
				const actions = p.action?.length === 3 ? [] : (p.action ?? [])
				const query = actions.map((action) => `action=${action}`).join('&')
				return `repo:${collection}${query ? `?${query}` : ''}`
			})
		)
}

/**
 * What the app asks for at sign-in: the radio.4000 permission set once it is published
 * (users then see its title and description), the same permissions as raw scopes before.
 * Blob uploads (channel images) can't be part of a set and are always asked separately.
 */
export const OAUTH_SCOPE = [
	'atproto',
	...(app.oauth.permissionSetPublished
		? [`include:${AUTH}`]
		: repoScopes(authSet.defs.main.permissions)),
	...app.oauth.blobAccept.map((accept) => `blob:${accept}`)
].join(' ')

export const CLIENT_METADATA_PATH = '/client-metadata.json'

/** Production origin of the app */
export const APP_ORIGIN = `https://${app.domain}`

export function clientMetadata(origin: string) {
	return {
		client_id: `${origin}${CLIENT_METADATA_PATH}`,
		client_name: app.name,
		client_uri: origin,
		// Shown on the authorization page by servers that display client logos
		logo_uri: `${origin}${app.logo}`,
		redirect_uris: [`${origin}/`],
		scope: OAUTH_SCOPE,
		grant_types: ['authorization_code', 'refresh_token'],
		response_types: ['code'],
		application_type: 'web',
		token_endpoint_auth_method: 'none',
		dpop_bound_access_tokens: true
	}
}
