<script>
	import {getChannelCtx} from '#lib/contexts.js'
	import ChatRoom from '#lib/components/chat-room.svelte'
	import * as m from '#lib/paraglide/messages.js'

	const channelCtx = getChannelCtx()
</script>

{#if channelCtx.data}
	<ChatRoom radioDid={channelCtx.data.id} />
{:else}
	<r4-empty><p role="status">{m.common_loading()}</p></r4-empty>
{/if}
