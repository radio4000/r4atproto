<script>
	import {untrack} from 'svelte'
	import {goto} from '$app/navigation'
	import {channelHref, trackHref as trackPermalink} from '#lib/links.js'
	import {appState, canEditChannel} from '#lib/app-state.svelte.js'
	import {
		togglePlayPause,
		next,
		previous,
		seekTo,
		resyncAutoRadio,
		leaveAutoRadio,
		rejoinAutoRadio,
		toggleDeckCompact,
		expandDeck,
		toggleShuffle
	} from '#lib/api.js'
	import {isMobileViewport} from '#lib/utils.js'
	import {isGroupControlDeck, sortedListeningDeckIds} from '#lib/deck.js'
	import {createDeckDisplay} from '#lib/player/deck-display.svelte.js'
	import {getActiveQueue, canPlay, canPrev, canNext} from '#lib/player/queue.js'
	import {parseUrl} from 'media-now/parse-url'
	import * as m from '#lib/paraglide/messages.js'
	import Icon from '#lib/components/icon.svelte'
	import PopoverMenu from '#lib/components/popover-menu.svelte'
	import DeckMenu from '#lib/components/deck-menu.svelte'
	import AutoRadioButton from '#lib/components/auto-radio-button.svelte'
	import ChannelMicroCard from '#lib/components/channel-micro-card.svelte'
	import TrackCard from '#lib/components/track-card.svelte'
	import SpeedControl from '#lib/components/speed-control.svelte'
	import VolumeControl from '#lib/components/volume-control.svelte'
	import {tooltip} from '#lib/components/tooltip-attachment.svelte.js'
	import PlayerProgress from '#lib/components/player-progress.svelte'
	import {shortcutHint} from '#lib/keyboard.js'

	/** @type {{deckId: number, showEdgeControls?: boolean}} */
	let {deckId, showEdgeControls = true} = $props()

	let deck = $derived(appState.decks[deckId])
	let listeningDeckIds = $derived(sortedListeningDeckIds(appState.decks))
	let isListeningGroupControlDeck = $derived(isGroupControlDeck(deck, deckId, listeningDeckIds))

	// deckId never changes for this component instance — it's rendered inside
	// an {#each ... (deckId)} keyed block, so a changed deckId remounts it.
	const display = createDeckDisplay(untrack(() => deckId))
	const track = $derived(display.track)
	const displayTrack = $derived(display.displayTrack)
	const displayChannel = $derived(display.displayChannel)
	const headerChannel = $derived(display.headerChannel)
	const secondaryChannel = $derived(display.secondaryHeaderChannel)
	let canEditTrackChannel = $derived(
		Boolean(displayChannel?.id && canEditChannel(displayChannel.id))
	)
	let trackHref = $derived(
		displayTrack?.id?.startsWith('at://') ? trackPermalink(displayTrack) : undefined
	)
	let provider = $derived(
		displayTrack?.provider ||
			(displayTrack?.url ? parseUrl(displayTrack.url)?.provider : null) ||
			null
	)

	let activeQueue = $derived(getActiveQueue(deck))
	let canPlayFromQueue = $derived(canPlay(activeQueue, track?.id))
	let canPrevFromQueue = $derived(canPrev(activeQueue, track?.id))
	let canNextFromQueue = $derived(canNext(activeQueue, track?.id))

	let deckMenu = $state(/** @type {{close: () => void} | undefined} */ (undefined))
</script>

{#snippet playButton()}
	<button
		data-primary
		aria-pressed={Boolean(deck?.is_playing)}
		onclick={() => togglePlayPause(deckId)}
		aria-label={m.player_compact_play_pause()}
		disabled={!canPlayFromQueue}
		{@attach tooltip({
			content:
				(deck?.is_playing ? m.player_tooltip_pause() : m.player_tooltip_play()) +
				shortcutHint('togglePlayPause')
		})}
	>
		<Icon icon={deck?.is_playing ? 'pause' : 'play-fill'} />
	</button>
{/snippet}

<!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
<r4-deck-compact-bar
	playing={Boolean(displayTrack)}
	onclick={(e) => {
		const target = e.target instanceof Element ? e.target : undefined
		const interactiveTarget = target?.closest(
			'button, input, select, textarea, [popover], [role="slider"]'
		)
		if (isMobileViewport()) {
			if (interactiveTarget) return
			if (target?.closest('a')) e.preventDefault()
			appState.active_deck_id = deckId
			expandDeck(deckId)
			return
		}
		if (interactiveTarget || target?.closest('a')) return
		appState.active_deck_id = deckId
	}}
>
	{#if appState.show_track_range_control !== false && displayTrack}
		<PlayerProgress
			currentTime={deck?.media_current_time ?? 0}
			mediaDuration={deck?.media_duration ?? NaN}
			trackDuration={displayTrack?.duration}
			isPlaying={Boolean(deck?.is_playing)}
			disabled={Boolean(deck?.listening_to_channel_id)}
			onseek={(val) => {
				if (deck) deck.media_current_time = val
				seekTo(deckId, val)
			}}
		/>
	{/if}
	<r4-deck-compact-row>
		<r4-deck-compact-identity>
			{#if displayTrack}
				<!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
				<r4-deck-compact-track
					onclick={(e) => {
						if (isMobileViewport()) return
						if (!trackHref) return
						if (e.target instanceof Element && e.target.closest('button, a')) return
						goto(trackHref)
					}}
				>
					<TrackCard track={displayTrack} {deckId} showMenu={false} />
				</r4-deck-compact-track>
			{/if}
			<r4-deck-compact-channels>
				{#if headerChannel}
					<ChannelMicroCard channel={headerChannel} href={channelHref(headerChannel.slug)} />
				{/if}
				{#if secondaryChannel}
					<ChannelMicroCard channel={secondaryChannel} href={channelHref(secondaryChannel.slug)} />
				{/if}
			</r4-deck-compact-channels>
		</r4-deck-compact-identity>
		{#if !deck?.listening_to_channel_id && !deck?.auto_radio}
			<SpeedControl {deckId} {provider} />
		{/if}
		<menu>
			{#if !deck?.listening_to_channel_id && !deck?.auto_radio}
				<button
					onclick={() => previous(deckId, 'user_prev')}
					aria-label={m.player_compact_prev()}
					disabled={!canPrevFromQueue}
					{@attach tooltip({content: m.player_tooltip_prev() + shortcutHint('previousTrack')})}
				>
					<Icon icon="previous-fill" />
				</button>
				{@render playButton()}
				<button
					onclick={() => next(deckId, 'user_next')}
					aria-label={m.player_compact_next()}
					disabled={!canNextFromQueue}
					{@attach tooltip({content: m.player_tooltip_next() + shortcutHint('nextTrack')})}
				>
					<Icon icon="next-fill" />
				</button>
				<VolumeControl {deckId} />
				{#if activeQueue.length > 2}
					<button
						onclick={() => toggleShuffle(deckId)}
						aria-pressed={Boolean(deck?.shuffle)}
						aria-label={m.player_tooltip_shuffle()}
						{@attach tooltip({
							content: m.player_tooltip_shuffle() + shortcutHint('toggleShuffle')
						})}
					>
						<Icon icon="shuffle" />
					</button>
				{/if}
				{#if display.autoRadioAvailable}
					<AutoRadioButton size={14} onclick={() => rejoinAutoRadio(deckId)} />
				{/if}
			{:else if deck?.auto_radio}
				{@render playButton()}
				<VolumeControl {deckId} />
				<AutoRadioButton
					live
					drifted={!!deck?.auto_radio_drifted}
					size={14}
					onclick={() =>
						deck?.auto_radio_drifted ? resyncAutoRadio(deckId) : leaveAutoRadio(deckId)}
				/>
			{:else if !deck?.listening_to_channel_id}
				<VolumeControl {deckId} />
			{/if}
		</menu>
		<menu>
			{#if showEdgeControls && (!deck?.listening_to_channel_id || isListeningGroupControlDeck)}
				<PopoverMenu align="end" valign="top" closeOnClick={false} bind:this={deckMenu}>
					{#snippet trigger()}
						<Icon icon="options-horizontal" />
					{/snippet}
					<DeckMenu
						{deckId}
						compact
						track={displayTrack}
						channel={displayChannel}
						{trackHref}
						canEditTrack={canEditTrackChannel}
						autoRadioAvailable={display.autoRadioAvailable}
						closeMenu={() => deckMenu?.close()}
					/>
				</PopoverMenu>
			{/if}
			{#if showEdgeControls && isListeningGroupControlDeck}
				<button
					onclick={() => toggleDeckCompact(deckId)}
					aria-label={m.player_compact_show_panel()}
					{@attach tooltip({
						content: m.player_compact_show_panel() + shortcutHint('toggleCompactDeck')
					})}
				>
					<Icon icon="deck-panel" expanded />
				</button>
			{/if}
		</menu>
	</r4-deck-compact-row>
</r4-deck-compact-bar>

<style>
	/* A column: the identity/transport/actions row, then progress full-width. */
	r4-deck-compact-bar {
		display: flex;
		flex-direction: column;
		min-height: var(--deck-compact-min-height);
		min-width: 0;
		padding-block: var(--space-1);
		user-select: none;

		> :global(r4-player-progress) {
			order: 2;
			min-width: 0;
			padding: 0 var(--space-2);
		}
	}

	/* Identity takes whatever transport and actions leave; it shrinks instead of wrapping */
	r4-deck-compact-row {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-width: 0;
		padding-inline: var(--space-2);

		> menu {
			flex-wrap: nowrap;
			align-items: center;
			gap: var(--space-1);
			min-width: 0;
			flex: 0 0 auto;

			> :global(button) {
				min-width: var(--control-size-small);
				min-height: var(--control-size-small);
				padding: 0 var(--space-1);
			}
		}

		> menu:last-child {
			justify-content: flex-end;
		}

		> menu:not(:last-child) {
			justify-content: center;
			overflow-x: auto;
			scrollbar-width: none;

			:global(r4-volume-control) {
				width: var(--volume-width);
			}
		}
	}

	r4-deck-compact-identity {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-width: 0;
		flex: 1 1 auto;
	}

	r4-deck-compact-channels {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		flex: 0 1 auto;
		min-width: 0;
		max-width: 45%;
		overflow-x: auto;
		scrollbar-width: none;

		:global(r4-channel-micro-card) {
			--track-artwork-size: 1rem;
			flex: 0 1 auto;
			min-width: 6rem;
			max-width: max-content;
			background: none;
			border: none;
		}
	}

	r4-deck-compact-track {
		display: block;
		flex: 1 1 auto;
		min-width: 0;
		cursor: var(--interactive-cursor, pointer);

		:global(r4-track-card) {
			height: 100%;
			background: none;
			border: none;
		}

		:global(r4-track-card > article) {
			padding: 0;
		}
	}

	@media (max-width: 768px) {
		r4-deck-compact-bar {
			padding-inline: var(--space-1);
		}

		r4-deck-compact-channels :global(r4-channel-micro-card span) {
			max-width: 15ch;
		}

		/* Tapping the bar expands the deck on mobile: hide the duplicate */
		r4-deck-compact-row > menu:last-child > button {
			display: none;
		}
	}

	/* Mini player: channel, track and play on one row, progress below. Hidden via
	   CSS only, everything stays in the DOM. Above 1024px: the full desktop bar. */
	@media (max-width: 1024px) {
		/* Progress is display-only here; taps reach the bar's expand handler */
		r4-deck-compact-bar :global(r4-player-progress input) {
			pointer-events: none;
		}

		r4-deck-compact-row > menu:not(:last-child) > :global(:not([data-primary])) {
			display: none;
		}

		r4-deck-compact-row > :global(select) {
			display: none;
		}
	}
</style>
