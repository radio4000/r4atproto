<script lang="ts">
	import {onMount} from 'svelte'
	import {fly} from 'svelte/transition'
	import {cubicOut} from 'svelte/easing'
	import {MediaQuery} from 'svelte/reactivity'
	import '../styles/style.css'
	import {appState, deckAccent} from '#lib/app-state.svelte.js'
	import {sortedDeckIds} from '#lib/deck.js'
	import {toggleDeckCompact} from '#lib/api.js'
	import {leaveBroadcast} from '#lib/broadcast.js'
	import {initializeKeyboardShortcuts} from '#lib/keyboard.js'
	import {initSession} from '#lib/session.js'
	import {goto} from '$app/navigation'
	import {isMobileViewport} from '#lib/utils.js'
	import Seo from '#lib/components/seo.svelte'
	import app from '#lib/config/app.json' with {type: 'json'}
	import LayoutHeader from '#lib/components/layout-header.svelte'
	import DeckStrip from '#lib/components/deck-strip.svelte'
	import DeckCompactBar from '#lib/components/deck-compact-bar.svelte'
	import ToolTip from '#lib/components/tool-tip.svelte'
	import EditTrackDialog from '#lib/components/track-edit-dialog.svelte'
	import ShareDialog from '#lib/components/share-dialog.svelte'
	import Icon from '#lib/components/icon.svelte'
	import TracksKeepalive from '#lib/components/tracks-keepalive.svelte'
	import {tracksCollection} from '#lib/collections/tracks.js'
	import {queuePinTargets} from '#lib/collections/keepalive.js'
	import * as m from '#lib/paraglide/messages.js'
	import {getLocale} from '#lib/paraglide/runtime.js'
	import {dev} from '$app/env'

	let {children} = $props()
	let ready = $state(false)

	async function init() {
		try {
			// Back from an OAuth round trip: return to where sign-in started
			const returnTo = await initSession()
			if (returnTo && returnTo !== location.pathname) goto(returnTo, {replace: true})
		} catch (error) {
			console.error('Session error:', error)
		} finally {
			ready = true
		}
	}

	onMount(() => {
		// Mobile decks are either compact or expanded: persisted desktop strip decks normalize once
		if (isMobileViewport()) {
			for (const deck of Object.values(appState.decks)) {
				if (!deck.compact && !deck.expanded) deck.compact = true
			}
		}
		init()
		// Console handles for debugging, like r4-svelte's window.r5
		if (dev) {
			Promise.all([
				import('#lib/api.js'),
				import('#lib/collections/tracks.js'),
				import('#lib/collections/channels.js')
			]).then(([api, tracks, channels]) => {
				Object.assign(window, {
					r4: {
						appState,
						api,
						tracksCollection: tracks.tracksCollection,
						channelsCollection: channels.channelsCollection
					}
				})
			})
		}
		return initializeKeyboardShortcuts()
	})

	// Decks: same layout rules as r4-svelte
	let anyDeckExpanded = $derived(Object.values(appState.decks).some((deck) => deck.expanded))
	let anyDeckActive = $derived(
		Object.values(appState.decks).some(
			(d) =>
				!d.compact &&
				((d.playlist_tracks?.length ?? 0) > 0 ||
					Boolean(d.playlist_track) ||
					Boolean(d.listening_to_channel_id))
		)
	)
	let allDeckIds = $derived(sortedDeckIds(appState.decks))
	let compactDeckIds = $derived(allDeckIds.filter((id) => Boolean(appState.decks[id]?.compact)))
	let compactListeningDeckIds = $derived(
		compactDeckIds.filter((id) => Boolean(appState.decks[id]?.listening_to_channel_id))
	)
	let compactLocalDeckIds = $derived(
		compactDeckIds.filter((id) => !appState.decks[id]?.listening_to_channel_id)
	)

	// Theme: the saved preference, else the system's
	const prefersLight = new MediaQuery('(prefers-color-scheme: light)')
	const theme = $derived(appState.theme ?? (prefersLight.current ? 'light' : 'dark'))
	$effect(() => {
		document.documentElement.setAttribute('theme', theme)
	})

	$effect(() => {
		document.documentElement.lang = getLocale()
	})

	// Appearance settings: custom CSS variables (e.g. the accent) on :root
	let appliedVariables: string[] = []
	$effect(() => {
		const vars = appState.custom_css_variables ?? {}
		const root = document.documentElement.style
		for (const name of appliedVariables) if (!(name in vars)) root.removeProperty(name)
		for (const [name, value] of Object.entries(vars)) root.setProperty(name, value)
		appliedVariables = Object.keys(vars)
	})

	// On mobile an expanded deck fills the screen like a dialog: "back" should close it,
	// not navigate the page underneath. A same-URL history entry while expanded does that.
	let deckHistoryPushed = false
	let suppressPopstate = false

	$effect(() => {
		const expanded = anyDeckExpanded
		if (!isMobileViewport()) return
		if (expanded && !deckHistoryPushed) {
			history.pushState({r4DeckExpanded: true}, '', location.href)
			deckHistoryPushed = true
		} else if (!expanded && deckHistoryPushed) {
			deckHistoryPushed = false
			suppressPopstate = true
			history.back()
		}
	})

	onMount(() => {
		function onPopState() {
			if (suppressPopstate) {
				suppressPopstate = false
				return
			}
			if (!deckHistoryPushed) return
			deckHistoryPushed = false
			for (const deck of Object.values(appState.decks)) {
				if (deck.expanded) toggleDeckCompact(deck.id)
			}
		}
		window.addEventListener('popstate', onPopState)
		return () => window.removeEventListener('popstate', onPopState)
	})
</script>

<Seo title={app.name} description={m.welcome_tagline_channel()} plain />

{#if !ready}
	<r4-loading role="status">{m.common_loading()}</r4-loading>
{:else}
	<ToolTip />
	<EditTrackDialog />
	<ShareDialog />
	{#each allDeckIds as deckId (deckId)}
		<!-- Two pins per deck, the whole queue and the current track, so the playing row
		     stays resident while the other swaps. See collections/keepalive.ts. -->
		{@const queuePin = queuePinTargets(appState.decks[deckId], (id) => tracksCollection.get(id))}
		<TracksKeepalive slugs={queuePin.slugs} ids={queuePin.ids} />
		<TracksKeepalive
			ids={appState.decks[deckId]?.playlist_track ? [appState.decks[deckId].playlist_track] : []}
		/>
	{/each}
	<r4-layout deck-expanded={anyDeckExpanded} deck-active={anyDeckActive}>
		<LayoutHeader />
		<r4-content-wrapper>
			<r4-content>
				<r4-scroll-area>
					<main>
						{@render children()}
					</main>
				</r4-scroll-area>
				<DeckStrip />
			</r4-content>
			<r4-compact-decks empty={compactDeckIds.length === 0} aria-label={m.decks_compact_label()}>
				{#each compactLocalDeckIds as deckId (deckId)}
					<r4-compact-deck
						style:--deck-accent={deckAccent(allDeckIds, deckId)}
						transition:fly={{y: 24, duration: 200, easing: cubicOut}}
					>
						<DeckCompactBar {deckId} />
					</r4-compact-deck>
				{/each}
				{#if compactListeningDeckIds.length}
					<r4-compact-listening>
						<button
							aria-label={m.broadcasts_leave()}
							onclick={() => compactListeningDeckIds.forEach((id) => leaveBroadcast(id))}
						>
							<Icon icon="close" size={14} />
						</button>
						<r4-compact-listening-decks>
							{#each compactListeningDeckIds as deckId (deckId)}
								<r4-compact-deck
									style:--deck-accent={deckAccent(allDeckIds, deckId)}
									transition:fly={{y: 24, duration: 200, easing: cubicOut}}
								>
									<DeckCompactBar {deckId} showEdgeControls={false} />
								</r4-compact-deck>
							{/each}
						</r4-compact-listening-decks>
						<button
							aria-label={m.player_compact_show_panel()}
							onclick={() => toggleDeckCompact(compactListeningDeckIds[0])}
						>
							<Icon icon="deck-panel" expanded />
						</button>
					</r4-compact-listening>
				{/if}
			</r4-compact-decks>
		</r4-content-wrapper>
	</r4-layout>
{/if}

<style>
	/* Shell: same layout decisions as r4-svelte. On desktop the header is a rail
	   on the left, the page scrolls in the middle, decks stack on the right and
	   compact decks sit at the bottom. On mobile it is a column with the header
	   as a tab bar at the bottom. */
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
		position: sticky;
		top: 0;
		flex-shrink: 0;
		border-radius: var(--border-radius);
		border: var(--floating-border);
	}

	r4-layout[deck-expanded='true'] > :global(header) {
		display: none;
	}

	r4-content-wrapper {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-width: 0;
		min-height: 0;
		gap: var(--floating-gap);
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

	/* A single expanded deck takes the whole content width */
	r4-layout[deck-expanded='true'] r4-scroll-area {
		flex: 0 0 0;
		min-width: 0;
		overflow: hidden;
	}

	r4-layout[deck-expanded='true'] :global(r4-deck-strip) {
		flex: 1 1 auto;
		max-width: none;
		width: auto;
	}

	main {
		flex: 1;
		display: flex;
		flex-direction: column;
	}

	r4-compact-decks {
		display: flex;
		flex-direction: column;
		gap: var(--floating-gap);
		position: sticky;
		bottom: 0;
		z-index: 30;

		/* Stays mounted when empty, so the first compact deck gets its fly-in */
		&[empty='true'] {
			display: none;
		}
	}

	r4-compact-deck {
		display: block;
		min-width: 0;

		:global(r4-deck-compact-bar) {
			border-radius: var(--border-radius);
			overflow: hidden;
			background: var(--floating-bg);
			border: var(--floating-border);
		}
	}

	r4-compact-listening {
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		column-gap: var(--space-1);
		min-width: 0;
	}

	r4-compact-listening-decks {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	@media (max-width: 768px) {
		r4-layout {
			flex-direction: column;
		}

		r4-layout > :global(header) {
			order: 2;
			z-index: 40;
			border: none;
			border-block-start: var(--floating-border);
			border-radius: 0;
			/* Frosted: a distinct floating layer under the compact player */
			background: color-mix(in oklch, var(--floating-bg) 75%, transparent);
			backdrop-filter: blur(12px);
		}

		r4-content-wrapper {
			order: 1;
		}

		r4-content {
			flex-direction: column;
		}

		/* While a deck shows content, cap the page so the deck gets most of the viewport */
		r4-content:has(
				:global(
					r4-deck:not([compact='true']):is(
							:not([hide-video='true']),
							:not([listening='true']):not([auto='true']):not([hide-queue='true'])
						)
				)
			)
			r4-scroll-area {
			flex: 0 1 auto;
			max-height: 28dvh;
		}

		/* An open deck on mobile hides the tab bar, like an expanded one on desktop */
		r4-layout[deck-active='true'] > :global(header) {
			display: none;
		}

		r4-compact-decks {
			position: relative;
			bottom: auto;
		}

		r4-compact-listening > button:last-child {
			display: none;
		}
	}
</style>
