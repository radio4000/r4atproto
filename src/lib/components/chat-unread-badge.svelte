<script>
	import {unreadChat} from '#lib/chat-unread.svelte.js'
	import {channelChatHref} from '#lib/links.js'
	import Icon from '#lib/components/icon.svelte'
	import ui from '#lib/config/ui.json' with {type: 'json'}
	import * as m from '#lib/paraglide/messages.js'

	/** A link to a radio's chat, shown only while it has unread messages */
	/** @type {{radioDid: string, slug: string}} */
	let {radioDid, slug} = $props()

	const count = $derived(unreadChat[radioDid] ?? 0)
</script>

{#if count}
	<a
		href={channelChatHref(slug)}
		title={m.chat_unread({count})}
		aria-label={m.chat_unread({count})}
	>
		<Icon icon={ui.conceptIcons.chat} size={14} />
		<mark>{count}</mark>
	</a>
{/if}

<style>
	a {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		text-decoration: none;
		color: var(--accent-9);
	}
</style>
