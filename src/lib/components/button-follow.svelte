<script>
	import {useLiveQuery} from '#lib/useLiveQuery.svelte.js'
	import {eq} from '@tanstack/svelte-db'
	import {goto} from '$app/navigation'
	import {page} from '$app/state'
	import {followsCollection, followChannel, unfollowChannel} from '#lib/collections/follows.js'
	import {appState} from '#lib/app-state.svelte.js'
	import {authHref} from '#lib/links.js'
	import Icon from '#lib/components/icon.svelte'
	import * as m from '#lib/paraglide/messages.js'

	/** @type {{channel: import('#lib/types.js').Channel, label?: boolean}} */
	let {channel, label = false} = $props()

	const followQuery = useLiveQuery((q) =>
		q.from({follows: followsCollection}).where(({follows}) => eq(follows.id, channel.id))
	)

	let following = $derived((followQuery.data?.length ?? 0) > 0)
	let isOwn = $derived(appState.session?.did === channel.id)
	let text = $derived(following ? m.common_unfollow() : m.common_follow())

	function toggle(event) {
		event.stopPropagation()
		event.preventDefault()
		if (!appState.session) return goto(authHref(page.url.pathname))
		if (following) unfollowChannel(channel.id)
		else followChannel(channel.id)
	}
</script>

{#if !isOwn}
	<button type="button" onclick={toggle} aria-pressed={following} title={text} aria-label={text}>
		<Icon icon={following ? 'favorite-fill' : 'favorite'} />
		{#if label}{text}{/if}
	</button>
{/if}
