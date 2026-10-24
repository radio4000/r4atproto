<script>
	import {appState} from '#lib/app-state.svelte.js'
	import {getMediaPlayer} from '#lib/api.js'
	import {getBroadcastingChannelId, notifyBroadcastState} from '#lib/broadcast.js'
	import {tooltip} from '#lib/components/tooltip-attachment.svelte.js'
	import * as m from '#lib/paraglide/messages.js'
	import 'media-chrome'

	/** @type {{deckId: number}} */
	let {deckId} = $props()

	let deck = $derived(appState.decks[deckId])

	function notifyListeners() {
		const broadcastingChannelId = getBroadcastingChannelId()
		if (broadcastingChannelId) notifyBroadcastState(broadcastingChannelId)
	}

	function handleToggleMute() {
		if (!deck) return
		const mediaElement = getMediaPlayer(deckId)
		if (!mediaElement) return
		const nextMuted = !mediaElement.muted
		mediaElement.muted = nextMuted
		deck.muted = nextMuted
		notifyListeners()
	}

	function handleVolume(event) {
		const val = Number(event.currentTarget.value)
		if (deck) deck.volume = val
		const mediaElement = getMediaPlayer(deckId)
		if (mediaElement) {
			mediaElement.volume = val
			// Unmute if volume is raised and the mute was only technical (not user-explicit)
			if (val > 0 && mediaElement.muted && !deck?.muted) mediaElement.muted = false
		}
		notifyListeners()
	}
</script>

<r4-volume-control muted={Boolean(deck?.muted || deck?.volume === 0)}>
	<media-mute-button
		aria-pressed={Boolean(deck?.muted)}
		mediavolumelevel={deck?.muted ? 'off' : 'high'}
		onclick={handleToggleMute}
		{@attach tooltip({content: m.player_tooltip_mute(), position: 'top'})}
	></media-mute-button>
	<input
		type="range"
		min="0"
		max="1"
		step="0.01"
		value={deck?.volume ?? 1}
		style="--range-fill: {((deck?.volume ?? 1) * 100).toFixed(1)}%"
		oninput={handleVolume}
		aria-label={m.player_tooltip_mute()}
	/>
</r4-volume-control>

<style>
	r4-volume-control {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		flex: 1 1 6rem;
		min-width: 0;
	}

	input {
		flex: 1 1 0;
		min-width: 0;
		width: 100%;
	}

	r4-volume-control[muted='true'] input {
		--range-color: var(--gray-7);
		accent-color: var(--gray-7);
	}

	media-mute-button {
		min-width: var(--control-size);
		min-height: var(--control-size);
		border: 1px solid var(--color-control-border);
		border-radius: var(--border-radius);
		--media-control-background: var(--button-bg);
		--media-control-hover-background: var(--button-bg);
		--media-icon-color: currentColor;
		--media-icon-color-hover: currentColor;
		color: var(--button-color);
	}

	media-mute-button[aria-pressed='true'] {
		color: var(--accent-9);
		border-color: var(--accent-9);
		background-color: var(--accent-3);
	}
</style>
