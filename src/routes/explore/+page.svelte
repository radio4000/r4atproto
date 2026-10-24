<script>
	import {page} from '$app/state'
	import {goto} from '$app/navigation'
	import {useLiveQuery} from '#lib/useLiveQuery.svelte.js'
	import {channelsCollection} from '#lib/collections/channels.js'
	import {fetchLatestTracks} from '#lib/collections/feed.js'
	import {fuzzySearch, getChannelTags} from '#lib/utils.js'
	import app from '#lib/config/app.json' with {type: 'json'}
	import ChannelCard from '#lib/components/channel-card.svelte'
	import Tracklist from '#lib/components/tracklist.svelte'
	import SearchInput from '#lib/components/search-input.svelte'
	import FilterChips from '#lib/components/filter-chips.svelte'
	import Seo from '#lib/components/seo.svelte'
	import MapChannels from '#lib/components/map-channels.svelte'
	import * as m from '#lib/paraglide/messages.js'

	const TABS = ['radios', 'tracks', 'tags', 'map']
	const tab = $derived(
		TABS.includes(page.url.searchParams.get('tab') ?? '')
			? page.url.searchParams.get('tab')
			: 'radios'
	)
	const q = $derived(page.url.searchParams.get('q') ?? '')
	const tag = $derived(page.url.searchParams.get('tag') ?? '')
	const order = $derived(page.url.searchParams.get('order') === 'name' ? 'name' : 'updated')

	/** Change URL params, keeping the rest */
	function setParams(changes) {
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- built per navigation, not state
		const params = new URLSearchParams(page.url.search)
		for (const [key, value] of Object.entries(changes)) {
			if (value) params.set(key, value)
			else params.delete(key)
		}
		goto(`/explore?${params}`, {replace: true, reset: false})
	}

	const tabHref = (name) => (name === 'radios' ? '/explore' : `/explore?tab=${name}`)

	// Radios: every repo the relay lists as holding tracks
	const channelsQuery = useLiveQuery((query) => query.from({c: channelsCollection}))
	const radios = $derived.by(() => {
		const all = channelsQuery.data ?? []
		const sorted =
			order === 'name'
				? all.toSorted((a, b) => a.name.localeCompare(b.name))
				: all.toSorted((a, b) => (b.latest_track_at ?? '').localeCompare(a.latest_track_at ?? ''))
		return q ? fuzzySearch(q, sorted, ['name', 'slug', 'description']) : sorted
	})

	// Tracks and tags: the latest of every radio
	let feed = $state(/** @type {import('#lib/types.js').Track[] | undefined} */ (undefined))
	$effect(() => {
		if (tab !== 'radios' && !feed)
			fetchLatestTracks({perRadio: 25}).then((tracks) => (feed = tracks))
	})
	const tracks = $derived.by(() => {
		let list = feed ?? []
		if (tag) list = list.filter((t) => t.tags.includes(tag))
		return q ? fuzzySearch(q, list, ['title', 'description', 'slug']) : list
	})
	const tags = $derived(getChannelTags(feed ?? []))
</script>

<Seo title={m.explore_title({appName: app.name})} plain />

<r4-page size="wide">
	<r4-page-header>
		<h1>{m.nav_explore()}</h1>
		<nav aria-label={m.nav_explore()}>
			<menu>
				<li>
					<a href={tabHref('radios')} aria-current={tab === 'radios' ? 'page' : undefined}
						>{m.home_radios()}</a
					>
				</li>
				<li>
					<a href={tabHref('tracks')} aria-current={tab === 'tracks' ? 'page' : undefined}
						>{m.explore_tab_tracks()}</a
					>
				</li>
				<li>
					<a href={tabHref('tags')} aria-current={tab === 'tags' ? 'page' : undefined}
						>{m.explore_tab_tags()}</a
					>
				</li>
				<li>
					<a href={tabHref('map')} aria-current={tab === 'map' ? 'page' : undefined}
						>{m.nav_map()}</a
					>
				</li>
			</menu>
		</nav>
	</r4-page-header>

	{#if tab !== 'tags' && tab !== 'map'}
		<search>
			<SearchInput
				bind:value={() => q, (value) => setParams({q: value})}
				placeholder={tab === 'radios'
					? m.channels_search_placeholder()
					: m.search_tracks_placeholder()}
				debounce={200}
			/>
			{#if tab === 'radios'}
				<select
					aria-label={m.sort_order_label()}
					value={order}
					onchange={(e) => setParams({order: e.currentTarget.value === 'name' ? 'name' : ''})}
				>
					<option value="updated">{m.channels_order_updated()}</option>
					<option value="name">{m.channels_order_name()}</option>
				</select>
			{/if}
		</search>
	{/if}

	{#if tab === 'radios'}
		{#if radios.length}
			<r4-grid>
				{#each radios as channel (channel.id)}
					<ChannelCard {channel} />
				{/each}
			</r4-grid>
		{:else if channelsQuery.isReady}
			<r4-empty><p>{q ? `${m.search_no_results()} "${q}"` : m.channel_no_tracks()}</p></r4-empty>
		{:else}
			<r4-empty><p role="status">{m.common_loading()}</p></r4-empty>
		{/if}
	{:else if tab === 'tracks'}
		{#if tag}
			<FilterChips tags={[tag]} onRemoveTag={() => setParams({tag: ''})} />
		{/if}
		{#if tracks.length}
			<Tracklist
				{tracks}
				showSlug
				playContext
				playlistTitle={tag ? `#${tag}` : m.home_latest_network()}
				onTagClick={(t) => setParams({tag: t})}
				selectedTags={tag ? [tag] : []}
			/>
		{:else if feed}
			<r4-empty><p>{m.tracks_empty_filter()}</p></r4-empty>
		{:else}
			<r4-empty><p role="status">{m.common_loading()}</p></r4-empty>
		{/if}
	{:else if tab === 'map'}
		<r4-explore-map>
			<MapChannels channels={channelsQuery.data ?? []} loading={!channelsQuery.isReady} />
		</r4-explore-map>
	{:else}
		{#if tags.length}
			<ul>
				{#each tags as t (t.value)}
					<li>
						<a href="/explore?tab=tracks&tag={encodeURIComponent(t.value)}">#{t.value}</a>
						<small>{t.count}</small>
					</li>
				{/each}
			</ul>
		{:else if feed}
			<r4-empty><p>{m.tags_no_tags()}</p></r4-empty>
		{:else}
			<r4-empty><p role="status">{m.common_loading()}</p></r4-empty>
		{/if}
	{/if}
</r4-page>

<style>
	r4-explore-map {
		display: flex;
		height: var(--explore-map-height);
		border-radius: var(--border-radius);
		overflow: hidden;
	}

	search {
		select {
			flex: 0 0 auto;
		}
	}

	ul {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1);
		padding: 0;
		margin: 0;
		list-style: none;
	}

	ul > li {
		display: inline-flex;
		align-items: baseline;
		gap: var(--space-1);
		padding: var(--space-1) var(--space-2);
		background: var(--color-interface-elevated);
		border: 1px solid var(--color-interface-border);
		border-radius: calc(var(--border-radius) * 999);

		a {
			text-decoration: none;
		}

		small {
			color: var(--gray-9);
		}
	}
</style>
