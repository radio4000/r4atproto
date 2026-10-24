<script>
	import {inArray} from '@tanstack/db'
	import {useLiveQuery} from '#lib/useLiveQuery.svelte.js'
	import {channelsCollection} from '#lib/collections/channels.js'
	import {fetchFollowing} from '#lib/collections/follows.js'
	import {getChannelCtx} from '#lib/contexts.js'
	import ChannelCard from '#lib/components/channel-card.svelte'
	import * as m from '#lib/paraglide/messages.js'

	const channelCtx = getChannelCtx()

	let dids = $state(/** @type {string[] | undefined} */ (undefined))
	$effect(() => {
		const did = channelCtx.data?.id
		if (did) fetchFollowing(did).then((list) => (dids = list))
	})

	const channelsQuery = useLiveQuery(
		(q) =>
			dids?.length ? q.from({c: channelsCollection}).where(({c}) => inArray(c.id, dids)) : null,
		[() => dids?.join(',')]
	)
	// Keep the follow order
	const channels = $derived(
		(dids ?? []).flatMap((did) => {
			const channel = channelsQuery.data?.find((c) => c.id === did)
			return channel ? [channel] : []
		})
	)
</script>

{#if channels.length}
	<r4-grid>
		{#each channels as channel (channel.id)}
			<ChannelCard {channel} />
		{/each}
	</r4-grid>
{:else if dids && !dids.length}
	<r4-empty><p>{m.following_empty()}</p></r4-empty>
{:else}
	<r4-empty><p role="status">{m.common_loading()}</p></r4-empty>
{/if}
