<script lang="ts">
	import {onMount} from 'svelte'
	import {page} from '$app/state'
	import {bskyOAuth} from '#lib/services/bsky-oauth.js'
	import {buildAtprotoLoopbackClientId} from '@atproto/oauth-types'
	import {CLIENT_METADATA_PATH, OAUTH_SCOPE} from '#lib/oauth.js'
	import {session} from '#lib/state/session.js'
	import {theme} from '#lib/state/theme.js'
	import {getR4Profile} from '#lib/services/r4-service.js'
	import Player from '#lib/components/Player.svelte'
	import '../app.css'
	import '../styles/style.css'
	import {player} from '#lib/player/store.js'
	import {browser} from '$app/environment'
	import ToastContainer from '#lib/components/ui/toast/ToastContainer.svelte'
	import SeoHead from '#lib/components/SeoHead.svelte'
	import LayoutHeader from '#lib/components/layout-header.svelte'
	import * as m from '#lib/paraglide/messages.js'
	import {getLocale} from '#lib/paraglide/runtime.js'

	let {children} = $props()
	let ready = $state(false)
	let playerState = $state({
		playing: false,
		customPlaylist: [],
		context: null,
		index: -1,
		isShuffled: false
	})

	async function initOAuth() {
		try {
			// Over HTTPS we publish client metadata; plain-HTTP dev uses a loopback client
			const {protocol, origin, port} = window.location
			const clientId =
				protocol === 'https:'
					? `${origin}${CLIENT_METADATA_PATH}`
					: buildAtprotoLoopbackClientId({
							scope: OAUTH_SCOPE,
							redirect_uris: [`http://127.0.0.1${port ? `:${port}` : ''}/`]
						})

			await bskyOAuth.init(clientId)

			// Ensure OAuth callback is processed
			try {
				await bskyOAuth.handleCallback()
			} catch (e) {
				console.error('OAuth callback error:', e)
			}

			// Try restoring existing session
			try {
				if (!bskyOAuth.session?.did) {
					const did = bskyOAuth.getStoredDid && bskyOAuth.getStoredDid()
					if (did) {
						await bskyOAuth.restoreSession(did)
					}
				}
			} catch (e) {
				console.error('Session restore error:', e)
			}

			// Lazy resolve human handle
			if (bskyOAuth.isAuthenticated()) {
				bskyOAuth.resolveHandle().then((_) => {
					session.refresh()
				})
			}

			session.refresh()
		} catch (error) {
			console.error('OAuth initialization error:', error)
		} finally {
			ready = true
		}
	}

	// Load theme settings from profile
	async function loadThemeFromProfile() {
		if (!$session?.did) {
			console.log('[loadThemeFromProfile] No session DID, skipping')
			return
		}

		console.log('[loadThemeFromProfile] Loading profile for DID:', $session.did)

		try {
			const profile = await getR4Profile($session.did)
			console.log('[loadThemeFromProfile] Profile loaded:', profile)

			if (profile) {
				console.log('[loadThemeFromProfile] Applying theme from profile')
				theme.setMode(profile.mode)
				theme.setLightColors({
					background: profile.lightBackground,
					foreground: profile.lightForeground,
					accent: profile.lightAccent
				})
				theme.setDarkColors({
					background: profile.darkBackground,
					foreground: profile.darkForeground,
					accent: profile.darkAccent
				})
				console.log('[loadThemeFromProfile] Theme applied successfully')
			} else {
				console.log('[loadThemeFromProfile] No profile found, using defaults')
			}
		} catch (error) {
			console.error('[loadThemeFromProfile] Failed to load theme from profile:', error)
		}
	}

	// Blend the lightness of two "H S% L%" channel strings, keeping `from`'s hue
	// and saturation. Used to derive one muted tone from the active palette.
	function mixChannels(from: string, to: string, t: number): string {
		const f = from.trim().split(/\s+/)
		const g = to.trim().split(/\s+/)
		const lf = parseFloat(f[2])
		const lg = parseFloat(g[2])
		if (Number.isNaN(lf) || Number.isNaN(lg)) return from
		const l = lf + (lg - lf) * t
		return `${f[0]} ${f[1]} ${l.toFixed(1)}%`
	}

	// Apply theme to document using only background/foreground colors
	function applyTheme() {
		if (!browser) return

		const effectiveMode =
			$theme.mode === 'auto'
				? window.matchMedia('(prefers-color-scheme: dark)').matches
					? 'dark'
					: 'light'
				: $theme.mode

		document.documentElement.setAttribute('theme', effectiveMode)
		// Legacy Tailwind screens read the dark class
		document.documentElement.classList.toggle('dark', effectiveMode === 'dark')

		// Apply custom colors (only background/foreground)
		const colors = effectiveMode === 'dark' ? $theme.darkColors : $theme.lightColors

		const set = (name: string, value: string) => {
			document.documentElement.style.setProperty(name, value)
		}

		set('--background', colors.background)
		set('--foreground', colors.foreground)

		// Map all other tokens to either background or foreground
		set('--muted', mixChannels(colors.foreground, colors.background, 0.92))
		set('--card', colors.background)
		set('--popover', colors.background)
		set('--secondary', colors.background)
		set('--accent', colors.foreground)
		set('--primary', colors.foreground)
		set('--destructive', colors.foreground)
		set('--border', mixChannels(colors.foreground, colors.background, 0.78))
		set('--input', mixChannels(colors.foreground, colors.background, 0.78))
		set('--ring', colors.foreground)

		set('--card-foreground', colors.foreground)
		set('--popover-foreground', colors.foreground)
		set('--muted-foreground', mixChannels(colors.foreground, colors.background, 0.45))
		set('--secondary-foreground', colors.foreground)
		set('--accent-foreground', colors.background)
		set('--primary-foreground', colors.background)
		set('--destructive-foreground', colors.background)
	}

	onMount(() => {
		initOAuth().catch(console.error)
		const unsubscribe = player.subscribe((state) => {
			playerState = state
		})

		// Apply theme on mount
		applyTheme()

		// Watch for theme changes
		const themeUnsubscribe = theme.subscribe(() => {
			applyTheme()
		})

		// Watch for session changes to load profile (only way to load)
		const sessionUnsubscribe = session.subscribe((s) => {
			if (s?.did) {
				console.log('[session subscribe] Session updated, loading profile')
				loadThemeFromProfile()
			}
		})

		// Listen for system preference changes
		const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
		const handleChange = () => {
			if ($theme.mode === 'auto') {
				applyTheme()
			}
		}
		mediaQuery.addEventListener('change', handleChange)

		return () => {
			unsubscribe()
			themeUnsubscribe()
			sessionUnsubscribe()
			mediaQuery.removeEventListener('change', handleChange)
		}
	})

	// Until decks land, the legacy player fills the deck strip whenever something plays
	const hasPlayback = $derived(
		(playerState.customPlaylist?.length > 0 || playerState.context !== null) &&
			playerState.index >= 0
	)

	$effect(() => {
		document.documentElement.lang = getLocale()
	})
</script>

<SeoHead title="Radio4000" description={m.welcome_tagline_channel()} />

{#if !ready}
	<r4-loading role="status">{m.common_loading()}</r4-loading>
{:else}
	<r4-layout deck-active={hasPlayback}>
		<LayoutHeader />
		<r4-content>
			<r4-scroll-area>
				<main>
					{@render children()}
				</main>
			</r4-scroll-area>
			{#if hasPlayback}
				<r4-deck-strip>
					<Player visible={true} mobilePanelOpen={true} />
				</r4-deck-strip>
			{/if}
		</r4-content>
	</r4-layout>
{/if}

<ToastContainer />

<style>
	/* Shell: same layout decisions as r4-svelte. On desktop the header is a rail
	   on the left, the page scrolls in the middle and decks stack on the right.
	   On mobile it is a column with the header as a tab bar at the bottom. */
	r4-loading {
		display: grid;
		place-content: center;
		height: 100dvh;
	}

	r4-layout {
		display: flex;
		flex-direction: row;
		height: 100dvh;
		overflow: hidden;
		padding: var(--floating-padding);
		gap: var(--floating-gap);
	}

	r4-layout > :global(header) {
		flex-shrink: 0;
		border-radius: var(--border-radius);
		border: var(--floating-border);
	}

	r4-content {
		display: flex;
		flex: 1;
		min-width: 0;
		min-height: 0;
		gap: var(--floating-gap);
	}

	r4-scroll-area {
		flex: 1;
		min-width: 0;
		min-height: 0;
		overflow-y: auto;
		scrollbar-width: thin;
		overscroll-behavior: contain;
		scrollbar-gutter: stable;
		display: flex;
		flex-direction: column;
	}

	main {
		flex: 1;
		display: flex;
		flex-direction: column;
	}

	r4-deck-strip {
		display: flex;
		flex-direction: column;
		flex: 0 0 var(--deck-strip-width);
		min-height: 0;
		overflow: hidden;
		border-radius: var(--border-radius);
		background: var(--floating-bg);
		border: var(--floating-border);
	}

	@media (max-width: 768px) {
		r4-layout {
			flex-direction: column;
		}

		r4-layout > :global(header) {
			order: 2;
			border: none;
			border-block-start: var(--floating-border);
			border-radius: 0;
			background: color-mix(in oklch, var(--floating-bg) 75%, transparent);
			backdrop-filter: blur(12px);
		}

		r4-content {
			order: 1;
			flex-direction: column;
		}

		/* While a deck plays, it gets most of the viewport */
		r4-layout[deck-active='true'] r4-scroll-area {
			flex: 0 1 auto;
			max-height: 28dvh;
		}

		r4-deck-strip {
			flex: 1 1 auto;
		}
	}
</style>
