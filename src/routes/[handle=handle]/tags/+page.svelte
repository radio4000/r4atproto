<script>
	import {appState} from '#lib/app-state.svelte.js'
	import {setPlaylist, playTrack} from '#lib/api.js'
	import {getChannelCtx, getTracksQueryCtx} from '#lib/contexts.js'
	import {getChannelTags} from '#lib/utils.js'
	import {channelTracksHref} from '#lib/links.js'
	import Icon from '#lib/components/icon.svelte'
	import * as m from '#lib/paraglide/messages.js'

	const channelCtx = getChannelCtx()
	const tracksCtx = getTracksQueryCtx()
	const tags = $derived(getChannelTags(tracksCtx.data))

	/** Play the radio's tracks for one tag, newest first */
	function playTag(tag) {
		const ids = tracksCtx.data.filter((t) => t.tags.includes(tag)).map((t) => t.id)
		if (!ids.length) return
		const deckId = appState.active_deck_id
		setPlaylist(deckId, ids, {title: `#${tag}`, slug: channelCtx.slug})
		playTrack(deckId, ids[0], null, 'play_channel')
	}
</script>

{#if tags.length}
	<ul>
		{#each tags as tag (tag.value)}
			<li>
				<a href={channelTracksHref(channelCtx.slug, {tags: tag.value})}>#{tag.value}</a>
				<small>{tag.count}</small>
				<button
					type="button"
					onclick={() => playTag(tag.value)}
					title={m.channel_play_tag({tag: tag.value})}
				>
					<Icon icon="play-fill" size={14} />
				</button>
			</li>
		{/each}
	</ul>
{:else if tracksCtx.isReady}
	<r4-empty><p>{m.tags_no_tags()}</p></r4-empty>
{/if}

<style>
	ul {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1);
		padding: 0;
		margin: 0;
		list-style: none;
	}

	li {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		padding-inline-start: var(--space-2);
		background: var(--color-interface-elevated);
		border: 1px solid var(--color-interface-border);
		border-radius: calc(var(--border-radius) * 999);
	}

	a {
		text-decoration: none;
	}

	small {
		color: var(--gray-9);
	}

	button {
		min-width: var(--control-size-small);
		min-height: var(--control-size-small);
		padding: 0;
		border-radius: 50%;
		background: transparent;
		border-color: transparent;
	}
</style>
