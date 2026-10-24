<script>
	import {goto} from '$app/navigation'
	import {appState} from '#lib/app-state.svelte.js'
	import {useLiveQuery} from '#lib/useLiveQuery.svelte.js'
	import {channelsCollection} from '#lib/collections/channels.js'
	import {followsCollection} from '#lib/collections/follows.js'
	import {fetchLatestTracks} from '#lib/collections/feed.js'
	import {authHref, channelHref, searchHref} from '#lib/links.js'
	import app from '#lib/config/app.json' with {type: 'json'}
	import ChannelCard from '#lib/components/channel-card.svelte'
	import Tracklist from '#lib/components/tracklist.svelte'
	import SearchInput from '#lib/components/search-input.svelte'
	import IconR4 from '#lib/components/icon-r4.svelte'
	import Seo from '#lib/components/seo.svelte'
	import * as m from '#lib/paraglide/messages.js'

	let search = $state('')
	$effect(() => {
		const q = search.trim()
		if (q) goto(searchHref(q))
	})

	const followsQuery = useLiveQuery(followsCollection)
	const followedDids = $derived((followsQuery.data ?? []).map((f) => f.id))

	// Signed in with follows: their latest; otherwise the whole network's
	const feedDids = $derived(appState.session && followedDids.length ? followedDids : undefined)
	let feed = $state(/** @type {import('#lib/types.js').Track[] | undefined} */ (undefined))
	$effect(() => {
		const dids = feedDids
		fetchLatestTracks({perRadio: 4, dids}).then((tracks) => (feed = tracks.slice(0, 30)))
	})

	const RADIOS_ON_HOME = 12
	const channelsQuery = useLiveQuery((q) =>
		q
			.from({c: channelsCollection})
			.orderBy(({c}) => c.latest_track_at, 'desc')
			.limit(RADIOS_ON_HOME)
	)
	const radios = $derived(channelsQuery.data ?? [])
</script>

<Seo title={m.home_title({appName: app.name})} description={m.welcome_tagline_channel()} plain />

<r4-page size="wide">
	<r4-home-hero>
		<IconR4 size={56} />
		<hgroup>
			<h1>{m.welcome_tagline_channel()}</h1>
			<p>{m.home_atproto_note()}</p>
		</hgroup>
		<menu>
			{#if appState.session}
				<li><a href={channelHref(appState.session.handle)}>{m.home_your_channel()}</a></li>
			{:else}
				<li><a href={authHref('/')}>{m.home_start_radio()}</a></li>
			{/if}
			<li><a href="/explore">{m.home_explore_all()}</a></li>
		</menu>
		<search>
			<SearchInput bind:value={search} placeholder={m.search_title()} />
		</search>
	</r4-home-hero>

	<r4-home-columns>
		<section>
			<h2>{feedDids ? m.home_latest_following() : m.home_latest_network()}</h2>
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
			<h2><a href="/explore">{m.home_radios()}</a></h2>
			{#if radios.length}
				<r4-grid>
					{#each radios as channel (channel.id)}
						<ChannelCard {channel} />
					{/each}
				</r4-grid>
			{:else if !channelsQuery.isReady}
				<r4-empty><p role="status">{m.common_loading()}</p></r4-empty>
			{/if}
		</section>
	</r4-home-columns>
</r4-page>

<style>
	r4-home-hero {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-3);
		padding-block: var(--space-3);
		text-align: center;

		hgroup {
			display: flex;
			flex-direction: column;
			gap: var(--space-2);
			max-width: var(--measure);
			margin: 0;
		}

		h1 {
			font-size: var(--font-8);
		}

		p {
			color: var(--gray-10);
		}

		menu {
			justify-content: center;
		}

		search {
			display: flex;
			width: 100%;
			max-width: var(--measure-narrow);
		}
	}

	r4-home-columns {
		display: grid;
		grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
		gap: var(--space-3);
		align-items: start;

		@media (max-width: 1024px) {
			grid-template-columns: minmax(0, 1fr);
		}

		section {
			display: flex;
			flex-direction: column;
			gap: var(--space-2);
			min-width: 0;
		}

		h2 a {
			text-decoration: none;
		}
	}

	r4-home-columns r4-grid {
		--grid-min: 150px;
	}
</style>
