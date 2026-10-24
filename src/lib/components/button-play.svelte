<script>
	import {playChannel, togglePlayPause} from '#lib/api.js'
	import {appState} from '#lib/app-state.svelte.js'
	import Icon from '#lib/components/icon.svelte'
	import * as m from '#lib/paraglide/messages.js'

	/** @type {{channel: import('#lib/types.js').Channel, label?: string, trackId?: string}} */
	let {channel, label = '', trackId, ...rest} = $props()

	let loading = $state(false)

	let activeDeck = $derived(appState.decks[appState.active_deck_id])
	let isChannelLoaded = $derived(activeDeck?.playlist_slug === channel.slug)
	let isPlaying = $derived(isChannelLoaded && activeDeck?.is_playing)

	async function play(event) {
		event.preventDefault()
		if (isChannelLoaded) {
			togglePlayPause(appState.active_deck_id)
			return
		}
		loading = true
		await playChannel(appState.active_deck_id, channel, trackId)
		loading = false
	}
</script>

<button
	aria-busy={loading}
	disabled={loading}
	aria-pressed={Boolean(isPlaying)}
	onclick={play}
	title={isPlaying ? m.player_tooltip_pause() : m.player_tooltip_play()}
	{...rest}
>
	<Icon icon={isPlaying ? 'pause' : 'play-fill'} />
	{label}
</button>
