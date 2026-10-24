import {BrowserOAuthClient} from '@atproto/oauth-client-browser'
import type {OAuthSession} from '@atproto/oauth-client-browser'
import {Agent} from '@atproto/api'
import {OAUTH_SCOPE} from '../oauth'

interface Session {
	did: string
	handle: string
}

interface SignInResult {
	success: boolean
	error: {
		code: string
		message: string
	} | null
}

interface SessionResult {
	session: Session | null
	error: {
		code: string
		message: string
	} | null
}

interface PostResult {
	data: any
	error: {
		code: string
		message: string
	} | null
}

class BskyOAuthService {
	client: BrowserOAuthClient | null
	agent: Agent | null
	session: Session | null
	initialized: boolean
	initPromise: Promise<void> | null
	lastClientId: string | null

	constructor() {
		this.client = null
		this.agent = null
		this.session = null
		this.initialized = false
		this.initPromise = null
		this.lastClientId = null
	}

	#canonicalRedirectUri(): string | undefined {
		try {
			const {origin} = window.location
			// Always use root URL for redirect_uri since only root is in client metadata
			// The original path is saved in localStorage and restored after callback
			return origin + '/'
		} catch {
			return undefined
		}
	}

	async init(clientId: string): Promise<void> {
		this.lastClientId = clientId
		if (this.initialized) return
		if (!this.initPromise) {
			this.initPromise = this.#initInternal(clientId).finally(() => {
				this.initPromise = null
			})
		}
		return this.initPromise
	}

	async #initInternal(clientId: string): Promise<void> {
		if (this.initialized) return

		try {
			this.client = await BrowserOAuthClient.load({
				clientId: clientId,
				handleResolver: 'https://bsky.social' // Default AT Protocol handle resolver
			})

			// Process OAuth callback explicitly with persisted redirect if present
			const params = this.client.readCallbackParams()
			if (params) {
				let savedRedirect: string | undefined
				try {
					savedRedirect = localStorage.getItem('bsky-oauth-redirect') || undefined
				} catch {}
				try {
					const redirectUri = savedRedirect || this.#canonicalRedirectUri()
					const {session} = await this.client.initCallback(params, redirectUri as any)
					await this.#hydrateFromOAuthSession(session)
					try {
						localStorage.removeItem('bsky-oauth-redirect')
					} catch {}
				} catch (err) {
					if (this.client.responseMode === 'fragment') {
						history.replaceState(null, '', location.pathname + location.search)
					} else {
						history.replaceState(null, '', location.pathname)
					}
					console.error('OAuth callback failed:', err)
				}
			}

			this.initialized = true
			console.log('OAuth client initialized')
		} catch (error) {
			console.error('Failed to initialize OAuth client:', error)
			throw error
		}
	}

	private async ensureInitialized(): Promise<void> {
		if (this.initialized) return
		if (this.initPromise) {
			await this.initPromise
			return
		}
		if (this.lastClientId) {
			await this.init(this.lastClientId)
			return
		}
		throw new Error('OAuth client not initialized')
	}

	/**
	 * Start the OAuth login flow
	 * This will redirect the user to their AT Protocol service (PDS) for authentication
	 */
	async signIn(handle: string): Promise<SignInResult> {
		try {
			await this.ensureInitialized()
			if (!this.client) {
				throw new Error('OAuth client not available')
			}

			const redirectUri = this.#canonicalRedirectUri()
			try {
				localStorage.setItem('bsky-oauth-redirect', redirectUri || '')
			} catch {}
			await this.client.signIn(handle, {
				scope: OAUTH_SCOPE,
				state: window.location.pathname,
				redirect_uri: redirectUri as any
			})

			return {
				success: true,
				error: null
			}
		} catch (error) {
			console.error('OAuth sign-in error:', error)
			return {
				success: false,
				error: {
					code: 'oauth-signin-failed',
					message: (error as Error).message || 'Failed to start OAuth flow'
				}
			}
		}
	}

	/** Sign in again, asking to consent to the current scopes (after they changed). */
	async requestScopes(): Promise<void> {
		await this.ensureInitialized()
		if (!this.client) throw new Error('OAuth client not available')
		const handle = this.session?.handle || this.session?.did
		if (!handle) throw new Error('No session - please sign in first')
		await this.client.signIn(handle, {
			scope: OAUTH_SCOPE,
			state: window.location.pathname,
			prompt: 'consent'
		})
	}

	/** Resolve handle lazily and update session */
	async resolveHandle(): Promise<string | undefined> {
		if (!this.session?.did) return this.session?.handle
		try {
			const publicAgent = new Agent({service: 'https://api.bsky.app'})
			const profile = await publicAgent.getProfile({actor: this.session.did})
			const handle = profile.data?.handle || this.session.handle
			if (handle && handle !== this.session.handle) {
				this.session = {...this.session, handle}
			}
			return handle
		} catch {
			return this.session.handle
		}
	}

	/**
	 * Handle the OAuth callback after the user returns from their PDS
	 */
	async handleCallback(): Promise<SessionResult> {
		try {
			if (!this.initialized) {
				throw new Error('OAuth client not initialized')
			}

			if (!this.client) {
				throw new Error('OAuth client not available')
			}

			// Only attempt callback handling if URL has OAuth params
			const params = this.client.readCallbackParams()
			if (!params) {
				return {session: null, error: null}
			}

			let savedRedirect: string | undefined
			try {
				savedRedirect = localStorage.getItem('bsky-oauth-redirect') || undefined
			} catch {}
			const redirectUri = savedRedirect || this.#canonicalRedirectUri()
			const {session} = await this.client.initCallback(params, redirectUri as any)
			try {
				localStorage.removeItem('bsky-oauth-redirect')
			} catch {}
			await this.#hydrateFromOAuthSession(session)
			return {session: this.session, error: null}
		} catch (error) {
			console.error('OAuth callback error:', error)
			return {
				session: null,
				error: {
					code: 'callback-failed',
					message: (error as Error).message
				}
			}
		}
	}

	/**
	 * Restore an existing OAuth session
	 */
	async restoreSession(did: string): Promise<SessionResult> {
		try {
			if (!this.initialized) {
				throw new Error('OAuth client not initialized')
			}

			if (!this.client) {
				throw new Error('OAuth client not available')
			}

			const oauthSession = await this.client.restore(did)
			if (!oauthSession) {
				throw new Error('Session not found')
			}

			await this.#hydrateFromOAuthSession(oauthSession)

			return {
				session: this.session,
				error: null
			}
		} catch (error) {
			console.error('Session restore error:', error)
			localStorage.removeItem('bsky-oauth-did')
			return {
				session: null,
				error: {
					code: 'session-expired',
					message: 'Session expired'
				}
			}
		}
	}

	/**
	 * Post to the AT Protocol using the OAuth session
	 */
	async post(text: string): Promise<PostResult> {
		try {
			if (!this.agent) {
				throw new Error('Not authenticated')
			}

			const result = await this.agent.post({
				text,
				createdAt: new Date().toISOString()
			})

			return {data: result, error: null}
		} catch (error) {
			console.error('Post error:', error)
			return {
				data: null,
				error: {
					code: 'post-failed',
					message: (error as Error).message || 'Failed to post'
				}
			}
		}
	}

	/**
	 * Sign out and clear session
	 */
	async signOut(): Promise<void> {
		try {
			if (this.session?.did && this.client) {
				await this.client.revoke(this.session.did)
			}
		} catch (error) {
			console.error('Revoke error:', error)
		}

		this.agent = null
		this.session = null
		localStorage.removeItem('bsky-oauth-did')
	}

	/**
	 * Get stored DID if exists
	 */
	getStoredDid(): string | null {
		return localStorage.getItem('bsky-oauth-did')
	}

	/**
	 * Check if authenticated
	 */
	isAuthenticated(): boolean {
		return !!this.agent && !!this.session
	}

	/**
	 * Internal: hydrate agent + session from an OAuthSession
	 */
	async #hydrateFromOAuthSession(oauthSession: OAuthSession): Promise<void> {
		// Provide a SessionManager-like object so Agent knows the DID
		this.agent = new Agent({
			fetchHandler: (url, init) => oauthSession.fetchHandler(url, init),
			did: oauthSession.did
		})

		// Set initial handle from cache if available, else DID placeholder
		const cached = localStorage.getItem(`bsky-handle:${oauthSession.did}`)
		const initialHandle = cached || oauthSession.did
		this.session = {did: oauthSession.did, handle: initialHandle}
		localStorage.setItem('bsky-oauth-did', oauthSession.did)
	}
}

export const bskyOAuth = new BskyOAuthService()
