<script>
	import {appState} from '#lib/app-state.svelte.js'
	import {relativeDateDetailed} from '#lib/dates.js'
	import * as m from '#lib/paraglide/messages.js'
	import {trimWithEllipsis} from '#lib/utils.js'
	import {toggleChannelPlay, playChannelInNewDeck} from '#lib/api.js'
	import {findChannelDeck} from '#lib/deck.js'
	import {channelHref} from '#lib/links.js'
	import ChannelAvatar from './channel-avatar.svelte'
	import LinkEntities from './link-entities.svelte'
	import ButtonFollow from './button-follow.svelte'
	import PopoverMenu from './popover-menu.svelte'
	import Icon from './icon.svelte'
	import LiveBadge from './live-badge.svelte'

	/** @type {{channel: import('#lib/types.js').Channel, children?: import('svelte').Snippet}}*/
	let {channel, children} = $props()

	const href = $derived(channelHref(channel.slug))
	// The deck holding this channel drives both display and action
	const channelDeck = $derived(
		findChannelDeck(appState.decks, appState.active_deck_id, channel.slug)
	)
	const isPlaying = $derived(Boolean(channelDeck?.is_playing))

	let playLoading = $state(false)

	/** @param {MouseEvent} [event] */
	async function play(event) {
		event?.preventDefault()
		if (playLoading) return
		playLoading = true
		try {
			await toggleChannelPlay(channel)
		} finally {
			playLoading = false
		}
	}

	/** @param {MouseEvent} e */
	function handleDblClick(e) {
		if (e.target instanceof Element && e.target.closest('a, button')) return
		play(e)
	}
</script>

<r4-channel-card
	playing={isPlaying}
	ondblclick={handleDblClick}
	role="group"
	aria-label={channel.name}
>
	<figure>
		<ChannelAvatar src={channel.image} alt={channel.name} />
		<button
			type="button"
			aria-pressed={isPlaying}
			aria-busy={playLoading}
			onclick={play}
			title={isPlaying ? m.common_pause() : m.common_play()}
		>
			<Icon icon={isPlaying ? 'pause' : 'play-fill'} size={28} />
		</button>
	</figure>
	<section>
		<h3><a {href}>{channel.name}</a> <LiveBadge channelId={channel.id} /></h3>
		<small><a {href}>@{channel.slug}</a></small>
		{#if channel.description}
			<p>
				<LinkEntities slug={channel.slug} text={trimWithEllipsis(channel.description, 140)} />
			</p>
		{/if}
		{@render children?.()}
	</section>
	<footer>
		{#if channel.latest_track_at}
			<small>{relativeDateDetailed(channel.latest_track_at)}</small>
		{/if}
		<menu>
			<li><ButtonFollow {channel} /></li>
			<li>
				<PopoverMenu align="right" valign="top" label={m.common_more()}>
					{#snippet trigger()}
						<Icon icon="options-horizontal" />
					{/snippet}
					<menu>
						<li>
							<button type="button" role="menuitem" onclick={play}>
								<Icon icon={isPlaying ? 'pause' : 'play-fill'} />
								{isPlaying ? m.common_pause() : m.common_play()}
							</button>
						</li>
						<li>
							<button type="button" role="menuitem" onclick={() => playChannelInNewDeck(channel)}>
								<Icon icon="sidebar-fill-right" />
								{m.track_card_play_in_deck()}
							</button>
						</li>
						<li>
							<a {href} role="menuitem"><Icon icon="circle-info" /> {m.channel_card_visit()}</a>
						</li>
					</menu>
				</PopoverMenu>
			</li>
		</menu>
	</footer>
</r4-channel-card>

<style>
	r4-channel-card {
		display: flex;
		flex-flow: column nowrap;
		background: var(--color-interface-elevated);
		border: 1px solid var(--color-interface-border);
		border-radius: var(--border-radius);
		user-select: none;
		cursor: var(--interactive-cursor, pointer);
		transition:
			background var(--duration-1),
			border-color var(--duration-1);

		&:is(:hover, :focus-within) {
			background: var(--gray-3);
			border-color: var(--color-control-border-hover);
			--tag-bg: var(--accent-4);
			--tag-bg-hover: var(--accent-5);
			--tag-color: var(--accent-11);
		}

		/* Playing: no fill, no border, the accent name is the cue */
		&[playing='true']:not(:hover, :focus-within) {
			background: transparent;
			border-color: transparent;
		}

		&[playing='true'] h3 a {
			color: var(--accent-9);
		}
	}

	figure {
		position: relative;
		margin: 0;
		border-radius: var(--border-radius) var(--border-radius) 0 0;
		overflow: hidden;
		background: var(--gray-2);

		:global(r4-channel-avatar) {
			border-radius: 0;
		}

		/* The cover is a play button, revealed on hover */
		button {
			position: absolute;
			inset: 0;
			width: 100%;
			height: 100%;
			border: none;
			border-radius: 0;
			background: oklch(0 0 0 / 0.3);
			color: white;
			opacity: 0;
			transition: opacity var(--duration-2);

			&:is(:hover, :focus-visible),
			&[aria-pressed='true'] {
				opacity: 1;
				background: oklch(0 0 0 / 0.3);
			}
		}
	}

	section {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		padding: var(--space-2) var(--space-2) 0;
		min-width: 0;
		flex: 1;
	}

	h3 a,
	small a {
		text-decoration: none;
	}

	small a {
		color: var(--gray-10);
	}

	p {
		font-size: var(--font-3);
		overflow-wrap: anywhere;
		display: -webkit-box;
		-webkit-line-clamp: 3;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-1);
		padding: var(--space-1) var(--space-2) var(--space-2);

		> menu {
			margin-inline-start: auto;
			flex-wrap: nowrap;
		}

		> menu :global(button) {
			background: transparent;
			border-color: transparent;
		}
	}
</style>
