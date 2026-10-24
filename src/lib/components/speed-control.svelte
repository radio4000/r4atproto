<script>
	import {appState} from '#lib/app-state.svelte.js'
	import {getMediaPlayer} from '#lib/api.js'
	import {getBroadcastingChannelId, notifyBroadcastState} from '#lib/broadcast.js'
	import {tooltip} from '#lib/components/tooltip-attachment.svelte.js'
	import * as m from '#lib/paraglide/messages.js'
	import Icon from '#lib/components/icon.svelte'

	/** @type {{deckId: number, provider: string | null}} */
	let {deckId, provider} = $props()

	let deck = $derived(appState.decks[deckId])
	let useNativeAudio = $derived(provider === 'file')
	let supportsPlaybackSpeed = $derived(provider !== 'soundcloud' && Boolean(deck))
	const speedMin = 0.25
	let speedMax = $derived(useNativeAudio ? 3 : 2)
	// YouTube's IFrame API only accepts fixed steps (0.25 … 2); native audio takes any rate.
	let speedStep = $derived(useNativeAudio ? 0.01 : 0.25)
	let isCustomSpeed = $derived(deck?.speed != null && deck.speed !== 1)

	function handleSpeedChange(speed) {
		if (!deck) return
		deck.speed = speed
		const mediaElement = getMediaPlayer(deckId)
		if (mediaElement && 'playbackRate' in mediaElement) mediaElement.playbackRate = speed
		const broadcastingChannelId = getBroadcastingChannelId()
		if (broadcastingChannelId) {
			// Snapshot the position first, or listeners would scale the whole elapsed
			// time since track_played_at by the new speed.
			if (mediaElement && typeof mediaElement.currentTime === 'number') {
				deck.seek_position = mediaElement.currentTime
				deck.seeked_at = new Date().toISOString()
			}
			notifyBroadcastState(broadcastingChannelId)
		}
	}
</script>

{#if appState.show_speed_control && supportsPlaybackSpeed}
	<r4-speed-control custom={isCustomSpeed}>
		<button
			aria-pressed={isCustomSpeed}
			onclick={() => handleSpeedChange(1)}
			aria-label={m.player_reset_speed()}
			{@attach tooltip({content: m.player_reset_speed(), position: 'top'})}
		>
			<Icon icon="speed" />
			{Number(deck?.speed ?? 1).toFixed(2)}x
		</button>
		<input
			type="range"
			min={speedMin}
			max={speedMax}
			step={speedStep}
			value={deck?.speed ?? 1}
			oninput={(e) => handleSpeedChange(Number(e.currentTarget.value))}
			aria-label={m.player_reset_speed()}
			style="--range-fill: {(
				(((deck?.speed ?? 1) - speedMin) / (speedMax - speedMin)) *
				100
			).toFixed(1)}%"
		/>
	</r4-speed-control>
{/if}

<style>
	r4-speed-control {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		flex: 1 1 6rem;
		min-width: 0;
	}

	button {
		font-size: var(--font-1);
		/* Fixed-width digits so the button (and the range beside it) never resizes */
		font-variant-numeric: tabular-nums;
	}

	input {
		flex: 1 1 0;
		min-width: 0;
		width: 100%;
	}

	r4-speed-control[custom='false'] input {
		--range-color: var(--gray-7);
		accent-color: var(--gray-7);
	}
</style>
