<script>
	import {page} from '$app/state'
	import {goto} from '$app/navigation'
	import {getChannelCtx, getTracksQueryCtx} from '#lib/contexts.js'
	import {channelViewFromUrl} from '#lib/views.js'
	import {processViewTracks} from '#lib/views.svelte.js'
	import {channelTracksHref} from '#lib/links.js'
	import SearchInput from '#lib/components/search-input.svelte'
	import FilterChips from '#lib/components/filter-chips.svelte'
	import Tracklist from '#lib/components/tracklist.svelte'
	import AddTrackDialog from '#lib/components/track-add-dialog.svelte'
	import * as m from '#lib/paraglide/messages.js'

	const channelCtx = getChannelCtx()
	const tracksCtx = getTracksQueryCtx()

	const view = $derived(channelViewFromUrl(page.url, channelCtx.slug))
	const filter = $derived(view.sources[0])
	const filtering = $derived(Boolean(filter.tags?.length || filter.mention || filter.search))
	const tracks = $derived(
		filtering
			? processViewTracks(tracksCtx.data, view, {inputOrder: 'created-desc'})
			: tracksCtx.data
	)

	/** Update the URL filter, keeping the rest */
	function setParam(key, value) {
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- built per navigation, not state
		const params = new URLSearchParams(page.url.search)
		if (value) params.set(key, value)
		else params.delete(key)
		goto(channelTracksHref(channelCtx.slug, params), {replace: true, reset: false})
	}

	const removeTag = (tag) =>
		setParam('tags', (filter.tags ?? []).filter((t) => t !== tag).join(','))
	const toggleTag = (tag) =>
		filter.tags?.includes(tag)
			? removeTag(tag)
			: setParam('tags', [...(filter.tags ?? []), tag].join(','))
</script>

<r4-channel-tracks>
	{#if tracksCtx.data.length}
		<search>
			<SearchInput
				bind:value={() => filter.search ?? '', (q) => setParam('q', q)}
				placeholder={m.channel_tracks_search_placeholder()}
				debounce={200}
			/>
		</search>
		{#if filter.tags?.length || filter.mention}
			<FilterChips
				tags={filter.tags}
				mention={filter.mention}
				onRemoveTag={removeTag}
				onClearMention={() => setParam('mention', '')}
			/>
		{/if}
	{/if}

	{#if tracks.length}
		<Tracklist
			{tracks}
			grouped={!filtering}
			playContext
			canEdit={channelCtx.canEdit}
			onTagClick={toggleTag}
			selectedTags={filter.tags}
		/>
	{:else if !tracksCtx.isReady}
		<r4-empty><p role="status">{m.channel_loading()}</p></r4-empty>
	{:else if filtering}
		<r4-empty><p>{m.tracks_empty_filter()}</p></r4-empty>
	{:else if channelCtx.canEdit}
		<r4-empty>
			<p>{m.channel_empty_own()}</p>
			<AddTrackDialog label={m.track_add_title()} />
		</r4-empty>
	{:else}
		<r4-empty><p>{m.channel_no_tracks()}</p></r4-empty>
	{/if}
</r4-channel-tracks>

<style>
	r4-channel-tracks {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
</style>
