<script>
	import {page} from '$app/state'
	import {goto} from '$app/navigation'
	import {eq} from '@tanstack/db'
	import {useLiveQuery} from '#lib/useLiveQuery.svelte.js'
	import {appState, canEditChannel} from '#lib/app-state.svelte.js'
	import {tracksCollection} from '#lib/collections/tracks.js'
	import {channelsCollection} from '#lib/collections/channels.js'
	import {resolveIdentity, isDid} from '#lib/atproto/identity.js'
	import {shufflePlayChannel, playChannelInNewDeck, toggleChannelPlay} from '#lib/api.js'
	import {findChannelDeck} from '#lib/deck.js'
	import {hasAutoRadioCoverage} from '#lib/player/auto-radio.js'
	import {setChannelCtx, setTracksQueryCtx} from '#lib/contexts.js'
	import {channelHref} from '#lib/links.js'
	import ButtonFollow from '#lib/components/button-follow.svelte'
	import ChannelAvatar from '#lib/components/channel-avatar.svelte'
	import LinkEntities from '#lib/components/link-entities.svelte'
	import Icon from '#lib/components/icon.svelte'
	import LiveBadge from '#lib/components/live-badge.svelte'
	import PopoverMenu from '#lib/components/popover-menu.svelte'
	import Seo from '#lib/components/seo.svelte'
	import * as m from '#lib/paraglide/messages.js'

	let {children} = $props()

	const slug = $derived((page.params.handle ?? '').slice(1).toLowerCase())

	// A /@did:… link resolves to the handle
	$effect(() => {
		if (!isDid(slug)) return
		resolveIdentity(slug).then(({handle}) => {
			if (handle !== slug)
				goto(page.url.pathname.replace(`@${slug}`, `@${handle}`), {replace: true})
		})
	})

	const channelQuery = useLiveQuery((q) =>
		q.from({c: channelsCollection}).where(({c}) => eq(c.slug, slug))
	)
	const tracksQuery = useLiveQuery((q) =>
		q
			.from({t: tracksCollection})
			.where(({t}) => eq(t.slug, slug))
			.orderBy(({t}) => t.created_at, 'desc')
	)

	const channel = $derived(channelQuery.data?.[0])
	const tracks = $derived(tracksQuery.data ?? [])
	const canEdit = $derived(canEditChannel(channel?.id))

	setChannelCtx({
		get slug() {
			return slug
		},
		get data() {
			return channel
		},
		get isReady() {
			return channelQuery.isReady
		},
		get canEdit() {
			return canEdit
		}
	})
	setTracksQueryCtx({
		get data() {
			return tracks
		},
		get isReady() {
			return tracksQuery.isReady
		}
	})

	const channelDeck = $derived(findChannelDeck(appState.decks, appState.active_deck_id, slug))
	const isPlaying = $derived(Boolean(channelDeck?.is_playing))
	const autoRadio = $derived(hasAutoRadioCoverage(tracks))
	let playLoading = $state(false)

	async function withLoading(fn) {
		if (!channel || playLoading) return
		playLoading = true
		try {
			await fn()
		} finally {
			playLoading = false
		}
	}

	const play = () =>
		withLoading(() =>
			toggleChannelPlay(
				channel,
				page.params.rkey && tracks.find((t) => t.id.endsWith(`/${page.params.rkey}`))?.id
			)
		)
	const shuffle = () => withLoading(() => shufflePlayChannel(appState.active_deck_id, channel))

	/** A link's host without www, shown when it has no label */
	function linkHost(url) {
		try {
			return new URL(url).host.replace(/^www\./, '')
		} catch {
			return url
		}
	}

	const base = $derived(channelHref(slug))
	const tabs = $derived([
		{href: base, label: m.nav_tracks(), count: tracks.length || undefined},
		{href: `${base}/tags`, label: m.channel_tags_link()},
		{href: `${base}/following`, label: m.nav_following()},
		{href: `${base}/chat`, label: m.chat_panel_title()}
	])
</script>

<Seo
	title={channel ? `${channel.name} (@${slug})` : `@${slug}`}
	description={channel?.description ?? undefined}
	image={channel?.image ?? undefined}
/>

<r4-channel>
	<header>
		<r4-channel-avatar-link>
			<ChannelAvatar src={channel?.image} alt={channel?.name ?? slug} />
		</r4-channel-avatar-link>
		<hgroup>
			<h1><a href={base}>{channel?.name ?? `@${slug}`}</a></h1>
			<p>
				<a href={base}>@{slug}</a>
				{#if channel}<LiveBadge channelId={channel.id} />{/if}
			</p>
		</hgroup>
		<menu>
			<li>
				<button
					type="button"
					onclick={play}
					disabled={!tracks.length}
					aria-pressed={isPlaying}
					aria-busy={playLoading}
					title={isPlaying ? m.common_pause() : autoRadio ? m.auto_radio_join() : m.common_play()}
				>
					<Icon icon={isPlaying ? 'pause' : autoRadio ? 'infinite' : 'play-fill'} />
					<span>{isPlaying ? m.common_pause() : m.common_play()}</span>
				</button>
			</li>
			{#if channel}
				<li><ButtonFollow {channel} /></li>
			{/if}
			<li>
				<PopoverMenu align="right" label={m.common_more()}>
					{#snippet trigger()}<Icon icon="options-vertical" />{/snippet}
					<menu>
						{#if canEdit}
							<li><a href="/settings/radio"><Icon icon="edit" /> {m.channel_edit_radio()}</a></li>
						{/if}
						<li>
							<button type="button" onclick={shuffle} disabled={!tracks.length}>
								<Icon icon="shuffle" />
								{m.player_tooltip_shuffle()}
							</button>
						</li>
						{#if channel}
							<li>
								<button
									type="button"
									onclick={() => playChannelInNewDeck(channel)}
									disabled={!tracks.length}
								>
									<Icon icon="sidebar-fill-right" />
									{m.track_card_play_in_deck()}
								</button>
							</li>
						{/if}
						{#if channel}
							<li>
								<button type="button" onclick={() => (appState.modal_share = {channel})}>
									<Icon icon="share" />
									{m.share_native()}
								</button>
							</li>
						{/if}
						<li>
							<a href="https://bsky.app/profile/{slug}" target="_blank" rel="noopener noreferrer">
								<Icon icon="globe" />
								{m.channel_open_bluesky()}
							</a>
						</li>
					</menu>
				</PopoverMenu>
			</li>
		</menu>
		{#if channel?.links?.length}
			<ul aria-label={m.settings_radio_links()}>
				{#each channel.links as link (link.url)}
					<li>
						<a href={link.url} target="_blank" rel="noopener noreferrer me"
							>{link.title || linkHost(link.url)}</a
						>
					</li>
				{/each}
			</ul>
		{/if}
		{#if channel?.description}
			<p>
				<LinkEntities {slug} text={channel.description} />
			</p>
		{/if}
		<nav aria-label={channel?.name ?? slug}>
			<menu>
				{#each tabs as tab (tab.href)}
					<li>
						<a href={tab.href} aria-current={page.url.pathname === tab.href ? 'page' : undefined}>
							{tab.label}
							{#if tab.count}<small>{tab.count}</small>{/if}
						</a>
					</li>
				{/each}
			</menu>
		</nav>
	</header>

	{#if channelQuery.isReady && !channel}
		<r4-empty><p>{m.channel_not_found()}</p></r4-empty>
	{:else}
		{@render children()}
	{/if}
</r4-channel>

<style>
	r4-channel {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		container-type: inline-size;
	}

	header {
		display: grid;
		grid-template-columns: auto 1fr auto;
		grid-template-areas:
			'avatar title actions'
			'description description description'
			'links links links'
			'tabs tabs tabs';
		align-items: center;
		gap: var(--space-2) var(--space-3);
		padding: var(--space-3) var(--space-3) var(--space-2);
		background: var(--gray-2);
		border: 1px solid var(--color-interface-border);
		border-radius: var(--border-radius);
	}

	r4-channel-avatar-link {
		grid-area: avatar;
		display: block;
		width: var(--channel-header-avatar-size);
	}

	hgroup {
		grid-area: title;
		min-width: 0;
		margin: 0;

		h1 {
			font-size: var(--font-7);
			overflow-wrap: anywhere;
		}

		a {
			text-decoration: none;
		}

		p a {
			color: var(--gray-10);
		}
	}

	header > menu {
		grid-area: actions;
		flex-wrap: nowrap;
	}

	header > p {
		grid-area: description;
		max-width: var(--measure);
		overflow-wrap: anywhere;
	}

	header > ul {
		grid-area: links;
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1) var(--space-3);
		margin: 0;
		padding: 0;
		list-style: none;
		font-size: var(--font-3);
	}

	nav {
		grid-area: tabs;
		min-width: 0;
	}

	nav small {
		color: var(--gray-9);
	}

	/* Narrow: actions drop below the title */
	@container (max-width: 520px) {
		header {
			grid-template-columns: auto 1fr;
			grid-template-areas:
				'avatar title'
				'actions actions'
				'description description'
				'links links'
				'tabs tabs';
		}

		header > menu span {
			display: none;
		}
	}
</style>
