<script>
	import {eq} from '@tanstack/db'
	import {useLiveQuery} from '#lib/useLiveQuery.svelte.js'
	import {appState} from '#lib/app-state.svelte.js'
	import {broadcastsCollection} from '#lib/collections/broadcasts.js'
	import {joinBroadcast} from '#lib/broadcast.js'
	import Icon from '#lib/components/icon.svelte'
	import * as m from '#lib/paraglide/messages.js'

	/** A LIVE button for a radio that broadcasts right now: pressing it listens along. */
	/** @type {{channelId: string}} */
	let {channelId} = $props()

	const query = useLiveQuery((q) =>
		q.from({b: broadcastsCollection}).where(({b}) => eq(b.channel_id, channelId))
	)
	const live = $derived((query.data?.length ?? 0) > 0)
	const own = $derived(appState.session?.did === channelId)
	const listening = $derived(
		Object.values(appState.decks).some((d) => d.listening_to_channel_id === channelId)
	)
</script>

{#if live}
	<r4-live-badge>
		{#if own}
			<span><Icon icon="signal" size={12} />{m.status_live_short()}</span>
		{:else}
			<button
				type="button"
				aria-pressed={listening}
				title={m.channel_card_join_broadcast()}
				onclick={(e) => {
					e.preventDefault()
					e.stopPropagation()
					joinBroadcast(appState.active_deck_id, channelId)
				}}
			>
				<Icon icon="signal" size={12} />{m.status_live_short()}
			</button>
		{/if}
	</r4-live-badge>
{/if}

<style>
	r4-live-badge {
		display: inline-flex;
	}

	button,
	span {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		min-height: 0;
		min-width: 0;
		padding: 0 var(--space-1);
		font-size: var(--font-1);
		font-weight: 600;
		letter-spacing: 0.04em;
		line-height: 1.6;
		border: none;
		border-radius: 3px;
		background: var(--accent-9);
		color: var(--gray-1);
	}

	button:hover {
		background: var(--accent-10);
	}
</style>
