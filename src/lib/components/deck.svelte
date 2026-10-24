<script>
	import {page} from '$app/state'
	import {scale} from 'svelte/transition'
	import {cubicOut} from 'svelte/easing'
	import {appState} from '#lib/app-state.svelte.js'
	import {showPlayerParam, sortedListeningDeckIds} from '#lib/deck.js'
	import Player from '#lib/components/player.svelte'
	import QueuePanel from '#lib/components/queue-panel.svelte'

	/** @type {{deckId: number, hasHistory?: boolean}} */
	let {deckId, hasHistory = false} = $props()

	let deck = $derived(appState.decks[deckId])
	let showPlayer = $derived(showPlayerParam(page.url))
	let isListeningToBroadcast = $derived(Boolean(deck?.listening_to_channel_id))
	let isBroadcasting = $derived(Boolean(deck?.broadcasting_channel_id))
	let isAutoRadio = $derived(Boolean(deck?.auto_radio))
	let firstListeningDeckId = $derived(sortedListeningDeckIds(appState.decks)[0])

	// For deck 1: only show when there are tracks queued/playing or any history
	// exists. hasHistory comes from the parent strip's shared live query so we
	// don't spin up one per deck.
	let hasContent = $derived(
		(deck?.playlist_tracks?.length ?? 0) > 0 || Boolean(deck?.playlist_track) || hasHistory
	)

	// Deck 1 hides when empty; additional decks are always visible
	let visible = $derived(showPlayer && deck && (deckId !== 1 || hasContent))

	// `mounted` lags `visible` by one frame on the way in (not the way out).
	// When a deck's *component instance* is freshly created by deck-strip's
	// {#each} — deck 1 doesn't exist in appState.decks at all until it first
	// gets content — `visible` can already be true on this component's very
	// first render. Svelte only plays an intro transition on a genuine
	// false→true edge of an already-mounted block, not a block that starts
	// true, so without this every real play action (which sets deck fields
	// in one batch) skipped the entrance animation entirely.
	let mounted = $state(false)
	$effect(() => {
		if (!visible) {
			mounted = false
			return
		}
		if (mounted) return
		const id = requestAnimationFrame(() => {
			mounted = true
		})
		return () => cancelAnimationFrame(id)
	})

	// Inline deck width from stored value
	let videoMixOpacity = $derived.by(() => {
		if (!deck?.video_mix || !isListeningToBroadcast) return undefined
		if (deck.muted) return 0
		const volume = Number.isFinite(deck.volume) ? deck.volume : 1
		return Math.max(0, Math.min(1, volume))
	})
	let videoMixZ = $derived(deckId === firstListeningDeckId ? 30 : deck?.is_playing ? 20 : 10)
	let deckStyle = $derived.by(() => {
		/** @type {string[]} */
		const styles = []
		if (deck?.queue_panel_width) styles.push(`--deck-width: ${deck.queue_panel_width}px`)
		if (deck?.video_mix && isListeningToBroadcast) {
			styles.push(`--video-mix-opacity: ${videoMixOpacity ?? 1}`)
			styles.push(`--video-mix-z: ${videoMixZ}`)
		}
		return styles.join('; ')
	})

	let scrollToActive = $state(/** @type {(() => void) | undefined} */ (undefined))
	let deckEl = $state(/** @type {HTMLElement | undefined} */ (undefined))

	// Resize handle state
	let resizing = $state(false)

	/** @param {PointerEvent} e */
	function onResizeStart(e) {
		if (e.button !== 0) return
		e.preventDefault()
		e.stopPropagation()

		const handle = /** @type {HTMLElement} */ (e.currentTarget)
		handle.setPointerCapture(e.pointerId)

		resizing = true
		const startX = e.clientX
		const startWidth = deck?.queue_panel_width ?? 400

		/** @param {PointerEvent} moveEvent */
		function onMove(moveEvent) {
			// Dragging left edge: moving left = wider, moving right = narrower
			const delta = startX - moveEvent.clientX
			const newWidth = Math.max(280, Math.min(800, startWidth + delta))
			if (deck) deck.queue_panel_width = newWidth
		}

		/** @param {PointerEvent} upEvent */
		function onUp(upEvent) {
			resizing = false
			handle.releasePointerCapture(upEvent.pointerId)
			handle.removeEventListener('pointermove', /** @type {any} */ (onMove))
			handle.removeEventListener('pointerup', /** @type {any} */ (onUp))
		}

		handle.addEventListener('pointermove', /** @type {any} */ (onMove))
		handle.addEventListener('pointerup', /** @type {any} */ (onUp))
	}
</script>

{#if mounted}
	<r4-deck
		expanded={Boolean(deck?.expanded)}
		compact={Boolean(deck?.compact)}
		listening={isListeningToBroadcast}
		video-mix={Boolean(deck?.video_mix && isListeningToBroadcast)}
		broadcasting={isBroadcasting}
		auto={isAutoRadio}
		{resizing}
		hide-queue={Boolean(deck?.hide_queue_panel)}
		hide-video={Boolean(deck?.hide_video_player)}
		data-deck={deckId}
		style={deckStyle}
		bind:this={deckEl}
		transition:scale={{duration: 150, start: 0.96, opacity: 0, easing: cubicOut}}
	>
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<r4-deck-resize-handle onpointerdown={onResizeStart}></r4-deck-resize-handle>
		<r4-deck-body>
			<Player {deckId} {scrollToActive} {deckEl}>
				{#if !isListeningToBroadcast && !isAutoRadio}
					<QueuePanel {deckId} bind:scrollToActive />
				{/if}
			</Player>
		</r4-deck-body>
	</r4-deck>
{/if}

<style>
	r4-deck {
		display: flex;
		flex-direction: row;
		min-height: 0;
		min-width: var(--deck-min-width);
		width: var(--deck-width, var(--deck-default-width));
		flex-shrink: 0;
		border-radius: var(--border-radius);
		overflow: hidden;
		position: relative;
		background: var(--floating-bg);
		border: var(--floating-border);
	}

	/* Smoothly resize across compact/normal/expanded instead of snapping —
	   this is the deck's own box; deck-item's flex/width (deck-strip.svelte)
	   transitions in step so the outer wrapper doesn't clip it short. */
	r4-deck {
		transition:
			width var(--duration-2) var(--ease-out),
			height var(--duration-2) var(--ease-out),
			opacity var(--duration-2) var(--ease-out);
	}

	r4-deck:not([expanded='true']) {
		transition:
			width var(--duration-2) var(--ease-out),
			height var(--duration-2) var(--ease-out),
			opacity var(--duration-2) var(--ease-out),
			border-color var(--duration-2) var(--ease-out);
	}

	r4-deck-resize-handle {
		display: block;
		width: 3px;
		cursor: col-resize;
		border-right: 1px solid transparent;
		border-radius: var(--border-radius) 0 0 var(--border-radius);
		flex-shrink: 0;
		touch-action: none;
		transition: border-color 120ms ease;
	}

	r4-deck-resize-handle:hover,
	r4-deck-resize-handle:focus-visible,
	r4-deck[resizing='true'] r4-deck-resize-handle {
		border-right-color: var(--deck-accent, var(--gray-5));
	}

	@media (max-width: 768px) {
		r4-deck {
			flex: 1;
			min-width: 0;
			width: 100%;
		}

		/* deck has at least one visible panel (video or queue): fill available height */
		r4-deck:not([compact='true']):not([expanded='true']):is(
				:not([hide-video='true']),
				[listening='true'],
				[auto='true'],
				:not([listening='true']):not([auto='true']):not([hide-queue='true'])
			) {
			height: 100%;
		}

		r4-deck:not([compact='true']):not([expanded='true']):is(
				:not([hide-video='true']),
				[listening='true'],
				[auto='true'],
				:not([listening='true']):not([auto='true']):not([hide-queue='true'])
			)
			:global(media-controller:not([audio='true'])) {
			flex: 1 1 auto;
			min-height: 0;
			max-height: none;
			aspect-ratio: auto;
		}

		r4-deck:not([compact='true']):not([expanded='true']):is(
				:not([hide-video='true']),
				[listening='true'],
				[auto='true'],
				:not([listening='true']):not([auto='true']):not([hide-queue='true'])
			)
			:global(r4-queue-panel) {
			flex: 1 1 auto;
			min-height: 0;
		}

		r4-deck:not([compact='true']):not([expanded='true']):is(
				:not([hide-video='true']),
				[listening='true'],
				[auto='true'],
				:not([listening='true']):not([auto='true']):not([hide-queue='true'])
			)
			:global(r4-player > section > menu) {
			flex-wrap: wrap;
		}

		r4-deck-resize-handle {
			display: none;
		}
	}

	r4-deck[expanded='true'] {
		flex: 1 1 0;
		width: 100%;
		min-width: 0;
		max-width: none;
		height: 100%;
		min-height: 0;
	}

	r4-deck[expanded='true'] r4-deck-resize-handle {
		display: none;
	}

	r4-deck[expanded='true']:not([hide-queue='true']):not([auto='true']):not([listening='true'])
		:global(media-controller) {
		max-height: 25dvh;
	}

	r4-deck-body {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 0;
		min-width: 0;
	}

	/* Compact: collapse to zero width, stay in DOM for audio playback.
	   The DeckCompactBar at the bottom of the layout provides the compact UI.
	   Fades out first so the content doesn't visibly cram as the box shrinks. */
	r4-deck[compact='true'] {
		width: 0;
		min-width: 0;
		overflow: hidden;
		border: none;
		opacity: 0;
		pointer-events: none;
	}

	@media (max-width: 768px) {
		r4-deck[compact='true'] {
			height: 0;
			min-height: 0;
		}
	}

	r4-deck :global(r4-player > section r4-track-card[active='true']) {
		border-radius: var(--border-radius) var(--border-radius) 0 0;
	}

	/* Hide queue panel via CSS — keeps it in the DOM. Fades + collapses
	   instead of an instant display:none, via the same allow-discrete +
	   @starting-style pattern dialog.svelte uses. */
	r4-deck :global(r4-queue-panel) {
		opacity: 1;
		transition:
			opacity var(--duration-2) var(--ease-out),
			display var(--duration-2) allow-discrete;
	}

	r4-deck[hide-queue='true'] :global(r4-queue-panel) {
		display: none;
		opacity: 0;
	}

	@starting-style {
		r4-deck:not([hide-queue='true']) :global(r4-queue-panel) {
			opacity: 0;
		}
	}

	/* When queue is hidden, let video fill available space but not overflow —
	   transitions in step with the queue panel's own fade. */
	r4-deck[hide-queue='true'] :global(media-controller) {
		max-height: none;
		flex: 1;
	}

	/* In expanded + hide-queue, constrain so controls/footer stay visible */
	r4-deck[expanded='true'][hide-queue='true'] :global(media-controller) {
		max-height: calc(100dvh - 10rem);
	}

	/* Auto-radio: video fills available height (no queue competing for space) */
	r4-deck[auto='true'] :global(media-controller) {
		max-height: none;
		flex: 1;
	}

	/* Hide video via CSS — keeps media element in the DOM for audio playback.
	   Fades out first, same reasoning as the compact deck's width collapse. */
	r4-deck[hide-video='true'] :global(media-controller) {
		position: absolute;
		width: 0;
		height: 0;
		overflow: hidden;
		opacity: 0;
		pointer-events: none;
	}

	/* When video is hidden but queue is visible, queue fills the space.
	   Auto/listening decks have no queue in the DOM — show the placeholder there. */
	r4-deck[hide-video='true']:not([hide-queue='true']):not([auto='true']):not([listening='true'])
		:global(r4-player-placeholder) {
		display: none;
	}

	r4-deck[hide-video='true']:not([hide-queue='true']) :global(r4-queue-panel) {
		flex: 1 1 auto;
		min-height: 0;
	}
</style>
