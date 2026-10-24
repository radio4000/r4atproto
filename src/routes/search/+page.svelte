<script>
	import {page} from '$app/state'
	import {goto} from '$app/navigation'
	import {useLiveQuery} from '#lib/useLiveQuery.svelte.js'
	import {channelsCollection} from '#lib/collections/channels.js'
	import {viewFromUrl} from '#lib/views.js'
	import {queryView} from '#lib/views.svelte.js'
	import {fuzzySearch} from '#lib/utils.js'
	import {channelHref, searchHref} from '#lib/links.js'
	import ChannelCard from '#lib/components/channel-card.svelte'
	import Tracklist from '#lib/components/tracklist.svelte'
	import SearchInput from '#lib/components/search-input.svelte'
	import Seo from '#lib/components/seo.svelte'
	import * as m from '#lib/paraglide/messages.js'

	const q = $derived(page.url.searchParams.get('q') ?? '')
	// r4's search syntax: "@radio #tag words"
	const view = $derived({...viewFromUrl(page.url), limit: 200})
	const results = queryView(() => view)

	const channelsQuery = useLiveQuery((query) => query.from({c: channelsCollection}))
	const words = $derived(q.replace(/[@#]\S+/g, '').trim())
	const radios = $derived(
		words
			? fuzzySearch(words, channelsQuery.data ?? [], ['name', 'slug', 'description'], {limit: 12})
			: []
	)

	// A query that looks like a handle can be opened directly
	const handle = $derived(
		/^@?[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(q.trim()) ? q.trim().replace(/^@/, '') : ''
	)
</script>

<Seo title={q ? `${q} · ${m.nav_search()}` : m.search_title()} />

<r4-page size="wide">
	<search>
		<SearchInput
			bind:value={
				() => q,
				(value) => goto(value ? searchHref(value) : '/search', {replace: true, reset: false})
			}
			placeholder={m.search_title()}
			debounce={250}
			autofocus
		/>
	</search>

	{#if !q}
		<r4-empty>
			<p>{m.search_tip_slug()}</p>
		</r4-empty>
	{:else}
		{#if handle}
			<p><a href={channelHref(handle)}>{m.search_open_radio({handle})}</a></p>
		{/if}

		{#if radios.length}
			<section>
				<h2>
					{radios.length === 1
						? m.search_channel_one({count: 1})
						: m.search_channel_other({count: radios.length})}
				</h2>
				<r4-grid>
					{#each radios as channel (channel.id)}
						<ChannelCard {channel} />
					{/each}
				</r4-grid>
			</section>
		{/if}

		<section>
			{#if results.loading}
				<r4-empty><p role="status">{m.search_loading_tracks()}</p></r4-empty>
			{:else if results.tracks.length}
				<h2>
					{results.count === 1
						? m.search_track_one({count: 1})
						: m.search_track_other({count: results.count})}
				</h2>
				<Tracklist tracks={results.tracks} showSlug playContext playlistTitle={q} />
			{:else}
				<r4-empty><p>{m.search_no_results()} "{q}"</p></r4-empty>
			{/if}
		</section>
	{/if}
</r4-page>

<style>
	search {
		display: flex;
		position: sticky;
		top: 0;
		z-index: 2;
		padding-block: var(--space-1);
		background: var(--color-interface);
	}

	section {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
</style>
