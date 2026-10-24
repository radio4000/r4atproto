<script>
	import {appState} from '#lib/app-state.svelte.js'
	import {getMediaPlayer} from '#lib/api.js'
	import {getBroadcastingChannelId, notifyBroadcastState} from '#lib/broadcast.js'
	import {tooltip} from '#lib/components/tooltip-attachment.svelte.js'
	import * as m from '#lib/paraglide/messages.js'
	import ui from '#lib/config/ui.json' with {type: 'json'}

	/** @type {{deckId: number, provider: string | null}} */
	let {deckId, provider} = $props()

	let deck = $derived(appState.decks[deckId])
	let supportsPlaybackSpeed = $derived(provider !== 'soundcloud' && Boolean(deck))
	let speed = $derived(deck?.speed ?? 1)

	function handleSpeedChange(rate) {
		if (!deck) return
		deck.speed = rate
		const mediaElement = getMediaPlayer(deckId)
		if (mediaElement && 'playbackRate' in mediaElement) mediaElement.playbackRate = rate
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
	<!-- A native select: the steps every provider accepts (YouTube only takes fixed rates) -->
	<select
		aria-label={m.settings_player_speed_control()}
		data-custom={speed !== 1}
		value={speed}
		onchange={(e) => handleSpeedChange(Number(e.currentTarget.value))}
		{@attach tooltip({content: m.settings_player_speed_control(), position: 'top'})}
	>
		{#each ui.player.speeds as option (option)}
			<option value={option}>{option}×</option>
		{/each}
	</select>
{/if}

<style>
	select {
		min-height: var(--control-size-small);
		padding: 0 var(--space-1);
		font-size: var(--font-2);
		font-variant-numeric: tabular-nums;
	}

	select[data-custom='true'] {
		color: var(--accent-9);
		border-color: var(--accent-9);
	}
</style>
