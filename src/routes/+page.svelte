<script>
	import {goto} from '$app/navigation'
	import {eq, inArray} from '@tanstack/db'
	import {appState} from '#lib/app-state.svelte.js'
	import {playTrack, setPlaylist, toggleChannelPlay} from '#lib/api.js'
	import {useLiveQuery} from '#lib/useLiveQuery.svelte.js'
	import {channelsCollection} from '#lib/collections/channels.js'
	import {tracksCollection} from '#lib/collections/tracks.js'
	import {followsCollection} from '#lib/collections/follows.js'
	import {broadcastsCollection} from '#lib/collections/broadcasts.js'
	import {fetchLatestTracks} from '#lib/collections/feed.js'
	import {findChannelDeck} from '#lib/deck.js'
	import {getChannelTags} from '#lib/utils.js'
	import {channelHref, searchHref} from '#lib/links.js'
	import app from '#lib/config/app.json' with {type: 'json'}
	import ChannelCard from '#lib/components/channel-card.svelte'
	import ChannelAvatar from '#lib/components/channel-avatar.svelte'
	import ChannelMicroCard from '#lib/components/channel-micro-card.svelte'
	import AddTrackDialog from '#lib/components/track-add-dialog.svelte'
	import BroadcastToggle from '#lib/components/broadcast-toggle.svelte'
	import Tracklist from '#lib/components/tracklist.svelte'
	import SearchInput from '#lib/components/search-input.svelte'
	import Icon from '#lib/components/icon.svelte'
	import Seo from '#lib/components/seo.svelte'
	import * as m from '#lib/paraglide/messages.js'

	let search = $state('')
	$effect(() => {
		const q = search.trim()
		if (q) goto(searchHref(q))
	})

	// Your radio: its tracks give the count and the top tags
	const session = $derived(appState.session)
	const ownTracksQuery = useLiveQuery((q) =>
		session ? q.from({t: tracksCollection}).where(({t}) => eq(t.did, session.did)) : null
	)
	const ownTracks = $derived(ownTracksQuery.data ?? [])
	const topTags = $derived(getChannelTags(ownTracks).slice(0, 12))
	const ownDeck = $derived(
		session ? findChannelDeck(appState.decks, appState.active_deck_id, session.handle) : undefined
	)

	function playTag(tag) {
		if (!session) return
		const ids = ownTracks
			.filter((t) => t.tags.includes(tag))
			.toSorted((a, b) => b.created_at.localeCompare(a.created_at))
			.map((t) => t.id)
		if (!ids.length) return
		setPlaylist(appState.active_deck_id, ids, {title: `#${tag}`, slug: session.handle})
		playTrack(appState.active_deck_id, ids[0], null, 'play_channel')
	}

	// Radios you follow, and who broadcasts right now
	const followsQuery = useLiveQuery(followsCollection)
	const followedDids = $derived((followsQuery.data ?? []).map((f) => f.id))
	const broadcastsQuery = useLiveQuery(broadcastsCollection)
	const liveIds = $derived((broadcastsQuery.data ?? []).map((b) => b.channel_id))
	const chipIds = $derived([...new Set([...liveIds, ...followedDids])])
	const chipsQuery = useLiveQuery(
		(q) =>
			chipIds.length
				? q.from({c: channelsCollection}).where(({c}) => inArray(c.id, chipIds))
				: null,
		[() => chipIds.join(',')]
	)
	const chips = $derived(chipIds.length ? (chipsQuery.data ?? []) : [])
	const liveChannels = $derived(chips.filter((c) => liveIds.includes(c.id)))
	const followedChannels = $derived(
		chips.filter((c) => followedDids.includes(c.id) && !liveIds.includes(c.id))
	)

	// Latest tracks: from the radios you follow, else the whole network
	const feedDids = $derived(session && followedDids.length ? followedDids : undefined)
	let feed = $state(/** @type {import('#lib/types.js').Track[] | undefined} */ (undefined))
	$effect(() => {
		const dids = feedDids
		fetchLatestTracks({dids}).then((tracks) => (feed = tracks.slice(0, 30)))
	})

	const RADIOS_ON_HOME = 12
	const radiosQuery = useLiveQuery((q) =>
		q
			.from({c: channelsCollection})
			.orderBy(({c}) => c.latest_track_at, 'desc')
			.limit(RADIOS_ON_HOME)
	)
	const radios = $derived(radiosQuery.data ?? [])
</script>

<Seo title={app.name} plain />

<r4-page size="wide">
	<search>
		<SearchInput bind:value={search} placeholder={m.search_title()} />
	</search>

	{#if session}
		<r4-home-radio>
			<a href={channelHref(session.handle)}>
				<ChannelAvatar
					src={appState.channel?.image}
					alt={appState.channel?.name ?? session.handle}
				/>
			</a>
			<hgroup>
				<h2>
					<a href={channelHref(session.handle)}>{appState.channel?.name ?? `@${session.handle}`}</a>
				</h2>
				<p>
					@{session.handle}
					{#if ownTracks.length}· {m.channel_tracks_count({count: ownTracks.length})}{/if}
					{#if !appState.channel?.has_record}· <a href="/settings/radio">{m.home_set_up_radio()}</a
						>{/if}
				</p>
			</hgroup>
			<menu>
				{#if ownTracks.length && appState.channel}
					<li>
						<button
							type="button"
							aria-pressed={Boolean(ownDeck?.is_playing)}
							onclick={() => appState.channel && toggleChannelPlay(appState.channel)}
						>
							<Icon icon={ownDeck?.is_playing ? 'pause' : 'play-fill'} />
							{ownDeck?.is_playing ? m.common_pause() : m.common_play()}
						</button>
					</li>
				{/if}
				<li><AddTrackDialog label={m.track_add_title()} /></li>
				<li><BroadcastToggle label /></li>
			</menu>
			{#if topTags.length}
				<ul aria-label={m.home_your_tags()}>
					{#each topTags as tag (tag.value)}
						<li>
							<button
								type="button"
								onclick={() => playTag(tag.value)}
								title={m.channel_play_tag({tag: tag.value})}
							>
								#{tag.value} <small>{tag.count}</small>
							</button>
						</li>
					{/each}
				</ul>
			{/if}
		</r4-home-radio>
	{/if}

	{#if liveChannels.length}
		<section>
			<h2>{m.home_broadcasting()}</h2>
			<ul>
				{#each liveChannels as channel (channel.id)}
					<li><ChannelMicroCard {channel} /></li>
				{/each}
			</ul>
		</section>
	{/if}

	{#if followedChannels.length}
		<section>
			<h2>{m.home_following()}</h2>
			<ul>
				{#each followedChannels as channel (channel.id)}
					<li><ChannelMicroCard {channel} /></li>
				{/each}
			</ul>
		</section>
	{/if}

	<section>
		<header>
			<h2>{feedDids ? m.home_latest_following() : m.home_latest_network()}</h2>
			<a href="/explore?tab=tracks">{m.explore_tab_tracks()}</a>
		</header>
		{#if feed?.length}
			<Tracklist
				tracks={feed}
				showSlug
				playContext
				playlistTitle={feedDids ? m.home_following() : m.home_latest_network()}
			/>
		{:else if feed}
			<r4-empty><p>{m.channel_no_tracks()}</p></r4-empty>
		{:else}
			<r4-empty><p role="status">{m.common_loading()}</p></r4-empty>
		{/if}
	</section>

	<section>
		<header>
			<h2>{m.home_radios()}</h2>
			<a href="/explore">{m.home_explore_all()}</a>
		</header>
		{#if radios.length}
			<r4-grid>
				{#each radios as channel (channel.id)}
					<ChannelCard {channel} />
				{/each}
			</r4-grid>
		{:else if !radiosQuery.isReady}
			<r4-empty><p role="status">{m.common_loading()}</p></r4-empty>
		{/if}
	</section>
</r4-page>

<style>
	r4-home-radio {
		display: grid;
		grid-template-columns: var(--home-avatar-size) 1fr auto;
		grid-template-areas:
			'avatar title actions'
			'tags tags tags';
		align-items: center;
		gap: var(--space-2) var(--space-3);
		padding: var(--space-3);
		background: var(--color-interface-elevated);
		border: 1px solid var(--color-interface-border);
		border-radius: var(--border-radius);

		> a {
			grid-area: avatar;
		}

		hgroup {
			grid-area: title;
			min-width: 0;
			margin: 0;

			h2 a {
				text-decoration: none;
			}

			p {
				color: var(--gray-10);
				font-size: var(--font-3);
			}
		}

		> menu {
			grid-area: actions;
			flex-wrap: nowrap;
		}

		> ul {
			grid-area: tags;
		}

		@media (max-width: 640px) {
			grid-template-columns: var(--home-avatar-size) 1fr;
			grid-template-areas:
				'avatar title'
				'actions actions'
				'tags tags';

			> menu {
				flex-wrap: wrap;
			}
		}
	}

	ul {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	r4-home-radio ul button {
		min-height: var(--control-size-small);
		border-radius: calc(var(--border-radius) * 999);
		padding: 0 var(--space-2);

		small {
			color: var(--gray-9);
		}
	}

	section {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		min-width: 0;

		> header {
			display: flex;
			align-items: baseline;
			justify-content: space-between;
			gap: var(--space-2);

			a {
				font-size: var(--font-3);
				color: var(--gray-10);
			}
		}
	}

	section r4-grid {
		--grid-min: var(--home-card-min);
	}
</style>
