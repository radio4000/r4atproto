<script>
	import {channelsCollection} from '#lib/collections/channels.js'
	import ChannelAvatar from '#lib/components/channel-avatar.svelte'
	import {channelHref} from '#lib/links.js'

	/** @type {{channel?: import('#lib/types.js').Channel, slug?: string | null, href?: string | undefined}} */
	let {channel, slug: slugProp, href} = $props()

	let effectiveSlug = $derived(channel?.slug ?? slugProp)
	// Most callers only have a slug: take the avatar from whatever the collection has loaded
	let resolvedChannel = $derived(
		channel ??
			(effectiveSlug
				? [...channelsCollection.state.values()].find((c) => c.slug === effectiveSlug)
				: undefined)
	)
	let linkHref = $derived(href ?? (effectiveSlug ? channelHref(effectiveSlug) : undefined))
</script>

{#snippet content()}
	<r4-channel-micro-card-avatar>
		<ChannelAvatar src={resolvedChannel?.image} alt={resolvedChannel?.name ?? effectiveSlug} />
	</r4-channel-micro-card-avatar>
	<span>@{effectiveSlug}</span>
{/snippet}

{#if effectiveSlug}
	<r4-channel-micro-card>
		{#if linkHref}
			<a href={linkHref}>{@render content()}</a>
		{:else}
			{@render content()}
		{/if}
	</r4-channel-micro-card>
{/if}

<style>
	r4-channel-micro-card,
	a {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		min-width: 0;
	}

	r4-channel-micro-card {
		min-height: 1.6rem;
		padding: var(--space-1);
		border-radius: var(--border-radius);
		background: var(--color-interface-elevated);
		border: 1px solid var(--color-interface-border);
		transition:
			background var(--duration-2),
			border-color var(--duration-2);
	}

	a {
		color: inherit;
		text-decoration: none;
	}

	/* Its own hover: it sits inside track rows that have their own */
	r4-channel-micro-card:has(a:is(:hover, :focus-visible)) {
		background: var(--gray-4);
		border-color: var(--color-control-border-hover);
	}

	r4-channel-micro-card-avatar {
		display: block;
		width: var(--track-artwork-size);
		height: var(--track-artwork-size);
		flex-shrink: 0;
	}

	span {
		display: block;
		font-size: var(--font-2);
		max-width: 20vw;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
</style>
