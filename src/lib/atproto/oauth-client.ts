/**
 * atproto OAuth in the browser, on @atproto/oauth-client-browser's defaults:
 * init() completes a callback or restores the last session, and the OAuth
 * `state` carries the path to return to after signing in.
 */
import {BrowserOAuthClient, type OAuthSession} from '@atproto/oauth-client-browser'
import {buildAtprotoLoopbackClientId} from '@atproto/oauth-types'
import {Agent} from '@atproto/api'
import {CLIENT_METADATA_PATH, OAUTH_SCOPE} from '../oauth'

let client: BrowserOAuthClient | undefined
let session: OAuthSession | undefined
let agent: Agent | undefined

/** Over HTTPS the app publishes client metadata; plain-HTTP dev uses a loopback client */
function clientId() {
	const {protocol, origin, port} = window.location
	if (protocol === 'https:') return `${origin}${CLIENT_METADATA_PATH}`
	return buildAtprotoLoopbackClientId({
		scope: OAUTH_SCOPE,
		redirect_uris: [`http://127.0.0.1${port ? `:${port}` : ''}/`]
	})
}

function use(next: OAuthSession | undefined) {
	session = next
	agent = next ? new Agent(next) : undefined
}

/** Load the client and pick up a session. Resolves with the path to return to after a sign-in. */
export async function initOAuth(): Promise<{returnTo?: string}> {
	client = await BrowserOAuthClient.load({
		clientId: clientId(),
		handleResolver: 'https://bsky.social'
	})
	const result = await client.init()
	use(result?.session)
	return {returnTo: result && 'state' in result ? (result.state ?? undefined) : undefined}
}

export function getAgent(): Agent | undefined {
	return agent
}

export function getDid(): string | undefined {
	return session?.did
}

/** Redirects to the account's PDS; resolves only if that fails */
export async function signIn(handle: string, returnTo = '/') {
	if (!client) throw new Error('OAuth client not loaded')
	await client.signIn(handle, {scope: OAUTH_SCOPE, state: returnTo})
}

/** Sign in again to consent to the current scope, e.g. after it grew */
export async function renewPermissions() {
	if (!client || !session) return
	await client.signIn(session.did, {
		scope: OAUTH_SCOPE,
		prompt: 'consent',
		state: window.location.pathname
	})
}

export async function signOut() {
	await session?.signOut().catch(() => {})
	use(undefined)
}
