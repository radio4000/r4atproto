<script>
	import {page} from '$app/state'
	import {goto} from '$app/navigation'
	import {appState} from '#lib/app-state.svelte.js'
	import {playTrack, setPlaylist, togglePlayPause} from '#lib/api.js'
	import {getChannelCtx, getTracksQueryCtx} from '#lib/contexts.js'
	import {TRACK} from '#lib/lexicons.js'
	import {authHref, channelHref} from '#lib/links.js'
	import {trackAddSearchParams} from '#lib/track-add.js'
	import {relativeDateDetailed, formatDuration} from '#lib/dates.js'
	import {trackImageUrl} from '#lib/utils.js'
	import Icon from '#lib/components/icon.svelte'
	import LinkEntities from '#lib/components/link-entities.svelte'
	import Tracklist from '#lib/components/tracklist.svelte'
	import Seo from '#lib/components/seo.svelte'
	import * as m from '#lib/paraglide/messages.js'

	const channelCtx = getChannelCtx()
	const tracksCtx = getTracksQueryCtx()

	const id = $derived(
		channelCtx.data ? `at://${channelCtx.data.id}/${TRACK}/${page.params.rkey}` : undefined
	)
	const track = $derived(tracksCtx.data.find((t) => t.id === id))
	const deck = $derived(appState.decks[appState.active_deck_id])
	const isCurrent = $derived(Boolean(track && deck?.playlist_track === track.id))
	const isPlaying = $derived(isCurrent && Boolean(deck?.is_playing))

	/** Other tracks of this radio sharing a tag */
	const related = $derived(
		track?.tags.length
			? tracksCtx.data
					.filter((t) => t.id !== track.id && t.tags.some((tag) => track.tags.includes(tag)))
					.slice(0, 20)
			: []
	)

	function play() {
		if (!track) return
		if (isCurrent) return togglePlayPause(appState.active_deck_id)
		setPlaylist(
			appState.active_deck_id,
			tracksCtx.data.map((t) => t.id),
			{slug: channelCtx.slug}
		)
		playTrack(appState.active_deck_id, track.id, null, 'user_click_track')
	}

	function addToRadio() {
		if (!track) return
		if (!appState.session) {
			goto(authHref(`/add?${trackAddSearchParams(track)}`))
			return
		}
		appState.modal_track_add = {track}
	}
</script>

{#if track}
	<Seo
		title={track.title}
		description={track.description ?? undefined}
		image={track.media_id ? trackImageUrl(track.media_id, 'hqdefault') : undefined}
	/>

	<r4-track-page playing={isPlaying}>
		{#if track.media_id && track.provider === 'youtube'}
			<figure>
				<img src={trackImageUrl(track.media_id, 'hqdefault')} alt={track.title} />
			</figure>
		{/if}
		<hgroup>
			<h1>{track.title}</h1>
			{#if track.description}
				<p><LinkEntities slug={track.slug} filterMentions text={track.description} /></p>
			{/if}
		</hgroup>
		<menu>
			<li>
				<button type="button" onclick={play} aria-pressed={isPlaying}>
					<Icon icon={isPlaying ? 'pause' : 'play-fill'} />
					{isPlaying ? m.common_pause() : m.common_play()}
				</button>
			</li>
			{#if channelCtx.canEdit}
				<li>
					<button type="button" onclick={() => (appState.modal_track_edit = {track})}>
						<Icon icon="edit" />
						{m.common_edit()}
					</button>
				</li>
			{:else}
				<li>
					<button type="button" onclick={addToRadio}>
						<Icon icon="add" />
						{m.track_add_to_radio()}
					</button>
				</li>
			{/if}
		</menu>
		<dl>
			<dt>{m.track_form_url_label()}</dt>
			<dd>
				<a href={track.url} target="_blank" rel="noopener noreferrer nofollow ugc">{track.url}</a>
			</dd>
			{#if track.discogs_url}
				<dt>{m.track_form_discogs_label()}</dt>
				<dd>
					<a href={track.discogs_url} target="_blank" rel="noopener noreferrer"
						>{track.discogs_url}</a
					>
				</dd>
			{/if}
			{#if track.duration}
				<dt>{m.batch_edit_sort_duration()}</dt>
				<dd>{formatDuration(track.duration)}</dd>
			{/if}
			<dt>{m.track_radio_label()}</dt>
			<dd><a href={channelHref(track.slug)}>@{track.slug}</a></dd>
			<dd>{m.track_added_on({date: relativeDateDetailed(track.created_at)})}</dd>
		</dl>
	</r4-track-page>

	{#if related.length}
		<Tracklist tracks={related} playContext canEdit={channelCtx.canEdit} />
	{/if}
{:else if tracksCtx.isReady}
	<r4-empty><p>{m.track_not_found()}</p></r4-empty>
{:else}
	<r4-empty><p role="status">{m.common_loading()}</p></r4-empty>
{/if}

<style>
	r4-track-page {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--space-3);
		padding: var(--space-3);
		background: var(--color-interface-elevated);
		border: 1px solid var(--color-interface-border);
		border-radius: var(--border-radius);
	}

	figure {
		margin: 0;
		max-width: var(--measure-narrow);

		img {
			width: 100%;
			aspect-ratio: 16 / 9;
			object-fit: cover;
			border-radius: var(--media-radius);
		}
	}

	h1 {
		font-size: var(--font-8);
		overflow-wrap: anywhere;
	}

	r4-track-page[playing='true'] h1 {
		color: var(--accent-9);
	}

	hgroup {
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	dd {
		overflow-wrap: anywhere;
	}

	dd:last-child {
		grid-column: 1 / -1;
		color: var(--gray-10);
	}
</style>
