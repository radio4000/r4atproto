<script lang="ts">
	import {tick, type Snippet} from 'svelte'
	import {goto} from '$app/navigation'
	import {
		playTrack,
		playNext,
		addToPlaylist,
		playTrackInNewDeck,
		togglePlayPause
	} from '#lib/api.js'
	import {deleteTrack} from '#lib/collections/tracks.js'
	import {channelsCollection} from '#lib/collections/channels.js'
	import {appState, canEditChannel} from '#lib/app-state.svelte.js'
	import {trackAddSearchParams} from '#lib/track-add.js'
	import type {Track, Channel} from '#lib/types.js'
	import Icon from './icon.svelte'
	import PopoverMenu from './popover-menu.svelte'
	import Dialog from './dialog.svelte'
	import LinkEntities from './link-entities.svelte'
	import * as m from '#lib/paraglide/messages.js'
	import {trackImageUrl} from '#lib/utils.js'
	import {authHref, trackHref} from '#lib/links.js'

	interface Props {
		track: Track
		index?: number
		deckId?: number
		/** Prebuilt trackId → deck info, hoisted out of the card to avoid iterating
		 * appState.decks per row. Optional: cards without it fall back to per-card lookup. */
		deckLookup?: {get(trackId: string): {deckId: number; isPlaying: boolean} | undefined}
		selected?: boolean
		onPlay?: (trackId: string) => void
		showImage?: boolean
		showSlug?: boolean
		canEdit?: boolean
		showMenu?: boolean
		onTagClick?: (tag: string) => void
		onMentionClick?: (slug: string) => void
		/** Tags currently active in the page's own filter — highlights matching
		 * #tags inside the description instead of leaving that to Tag's URL
		 * fallback (which only understands the channel tracks page's ?tags=). */
		selectedTags?: string[]
		menuAlign?: 'left' | 'right' | 'end'
		menuValign?: 'top' | 'bottom'
		onLocate?: () => void
		disableDoubleClickPlay?: boolean
		linkTitleToTrack?: boolean
		children?: Snippet<[Track]>
		description?: Snippet
	}

	let {
		track,
		index,
		deckId,
		deckLookup,
		selected = false,
		onPlay,
		showImage = true,
		showSlug = false,
		canEdit,
		showMenu = true,
		onTagClick,
		onMentionClick,
		selectedTags,
		menuAlign,
		menuValign,
		onLocate,
		disableDoubleClickPlay = false,
		linkTitleToTrack = false,
		children,
		description
	}: Props = $props()

	const isRealTrack = $derived(Boolean(track?.id?.startsWith('at://')))
	const permalink = $derived(isRealTrack ? trackHref(track) : '')
	// When a deckLookup is provided (tracklist rows), it already encodes the same
	// semantics the per-card branches below compute — see tracklist.svelte's builder.
	const deckInfo = $derived(deckLookup?.get(track?.id))
	const active = $derived.by(() => {
		if (deckLookup) return Boolean(deckInfo)
		if (deckId != null) {
			const deck = appState.decks[deckId]
			return deck?.playlist_track === track?.id
		}
		return Object.values(appState.decks).some((d) => d.playlist_track === track?.id)
	})
	const matchedDeckId = $derived.by(() => {
		if (deckLookup) return deckInfo?.deckId ?? deckId ?? appState.active_deck_id
		if (deckId != null) return deckId
		for (const [id, deck] of Object.entries(appState.decks)) {
			if (deck?.playlist_track === track?.id) return Number(id)
		}
		return appState.active_deck_id
	})
	const isTrackPlaying = $derived.by(() => {
		if (deckLookup) return deckInfo?.isPlaying ?? false
		const targetDeck = appState.decks[matchedDeckId]
		return Boolean(targetDeck?.playlist_track === track?.id && targetDeck?.is_playing)
	})
	const ytid = $derived(!showImage || !appState.show_track_artwork ? null : track.media_id)
	// default, mqdefault, hqdefault, sddefault, maxresdefault
	const imageSrc = $derived(ytid ? trackImageUrl(ytid) : null)

	const dblclick = (event: MouseEvent) => {
		if (disableDoubleClickPlay) return
		event.preventDefault()
		const target = event.target as HTMLElement
		// Let the meta links (discogs) and hashtag/mention links navigate normally
		if (target.closest('aside, button, a')) return
		if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0)
			return
		if (onPlay) {
			onPlay(track.id)
			return
		}
		playTrack(deckId ?? appState.active_deck_id, track.id, null, 'user_click_track')
	}

	const addToRadio = () => {
		if (!appState.session) {
			const query = trackAddSearchParams(track).toString()
			goto(authHref(`/add${query ? `?${query}` : ''}`))
			return
		}
		appState.modal_track_add = {track}
	}

	const editTrack = () => {
		appState.modal_track_edit = {track}
	}

	const shareTrack = () => {
		const channel = ([...channelsCollection.state.values()].find((ch) => ch.slug === track.slug) ??
			(track.slug ? ({slug: track.slug} as unknown as Channel) : undefined)) as Channel | undefined
		if (channel) appState.modal_share = {track, channel}
	}

	let showDeleteDialog = $state(false)
	/** Edit and delete show for the track's own account, unless the list says otherwise */
	const editable = $derived(canEdit ?? canEditChannel(track.did))
	let deleteError = $state('')
	let menu = $state<{close: () => void; open: () => Promise<void>}>()
	// A list renders thousands of cards and few menus get opened, so each card starts
	// with a lookalike trigger and mounts the real menu on first press.
	let menuMounted = $state(false)
	let articleEl = $state<HTMLElement>()

	async function mountMenu() {
		menuMounted = true
		await tick()
		await menu?.open()
		// The pressed placeholder is gone; keep focus on the trigger that replaced it
		articleEl?.querySelector<HTMLElement>('r4-popover-menu > button')?.focus({preventScroll: true})
	}

	function handleArtworkClick(event: MouseEvent) {
		event.preventDefault()
		event.stopPropagation()
		if (
			active &&
			matchedDeckId != null &&
			appState.decks[matchedDeckId]?.playlist_track === track.id
		) {
			togglePlayPause(matchedDeckId)
			return
		}
		if (onPlay) {
			onPlay(track.id)
			return
		}
		playTrack(deckId ?? appState.active_deck_id, track.id, null, 'user_click_track')
	}

	async function handleDelete() {
		deleteError = ''
		try {
			await deleteTrack({id: track.did, slug: track.slug}, track.id)
			showDeleteDialog = false
			menu?.close()
		} catch (error) {
			deleteError = m.track_delete_failed({
				message: error instanceof Error ? error.message : String(error)
			})
		}
	}
</script>

{#snippet artwork()}
	<img src={imageSrc} alt={track.title} loading={(index ?? 0) > 20 ? 'lazy' : undefined} />
{/snippet}

{#snippet text(interactive: boolean)}
	<hgroup>
		<h3
			data-locatable={Boolean(interactive && onLocate && !linkTitleToTrack)}
			onclick={interactive ? onLocate : undefined}
		>
			{#if interactive && linkTitleToTrack && isRealTrack}
				<a href={permalink}>{track.title}</a>
			{:else}
				{track.title}
			{/if}
		</h3>
		{#if interactive && description}
			<p>{@render description()}</p>
		{:else if track.description}
			<p>
				<LinkEntities
					slug={track.slug}
					filterMentions
					text={track.description}
					onTagClick={interactive ? onTagClick : undefined}
					onMentionClick={interactive ? onMentionClick : undefined}
					selectedTags={interactive ? selectedTags : undefined}
					deckId={matchedDeckId}
				/>
			</p>
		{/if}
	</hgroup>
{/snippet}

<r4-track-card {active} selected={selected && !active} bind:this={articleEl}>
	<article
		ondblclick={dblclick}
		onmousedown={(e) => {
			if (e.detail >= 2) e.preventDefault()
		}}
	>
		{#if ytid && showImage && appState.show_track_artwork}
			{#if active}
				<!-- The playing track's artwork is a plain image, not a hidden toggle -->
				{@render artwork()}
			{:else}
				<button
					type="button"
					title={isTrackPlaying ? m.common_pause() : m.common_play()}
					onclick={handleArtworkClick}
					ondblclick={(event) => event.stopPropagation()}
				>
					{@render artwork()}
				</button>
			{/if}
		{/if}
		{@render text(true)}
		{#if (isRealTrack && track.discogs_url) || showSlug}
			<aside>
				{#if isRealTrack && track.discogs_url}
					<a href="{permalink}/discogs" title={m.track_meta_discogs()}
						><Icon icon="radio-on" size={14} /></a
					>
				{/if}
				{#if showSlug}<small>@{track.slug}</small>{/if}
			</aside>
		{/if}
	</article>
	{#if showMenu && !menuMounted}
		<!-- Stands in for the menu until first tap; same dots and label -->
		<button type="button" aria-label={m.common_more()} onclick={mountMenu}></button>
	{:else if showMenu}
		<PopoverMenu
			bind:this={menu}
			label={m.common_more()}
			align={menuAlign}
			valign={menuValign ?? 'top'}
		>
			<menu>
				<li>
					<button
						type="button"
						role="menuitem"
						onclick={() => {
							if (onPlay) onPlay(track.id)
							else playTrack(deckId ?? appState.active_deck_id, track.id, null, 'user_click_track')
							menu?.close()
						}}><Icon icon="play-fill" />{m.common_play()}</button
					>
				</li>
				<li>
					<button
						type="button"
						role="menuitem"
						onclick={() => {
							playNext(deckId ?? appState.active_deck_id, [track.id])
							menu?.close()
						}}><Icon icon="next-fill" />{m.track_play_next()}</button
					>
				</li>
				<li>
					<button
						type="button"
						role="menuitem"
						onclick={() => {
							addToPlaylist(deckId ?? appState.active_deck_id, [track.id])
							menu?.close()
						}}><Icon icon="unordered-list" />{m.track_add_to_queue()}</button
					>
				</li>
				<li>
					<button
						type="button"
						role="menuitem"
						onclick={async () => {
							await playTrackInNewDeck(track.id, track.slug ?? undefined)
							menu?.close()
						}}><Icon icon="sidebar-fill-right" />{m.track_card_play_in_deck()}</button
					>
				</li>
				<li>
					<button type="button" role="menuitem" onclick={addToRadio}
						><Icon icon="add" />{m.track_add_to_radio()}</button
					>
				</li>
				{#if isRealTrack}
					<li>
						<button type="button" role="menuitem" onclick={shareTrack}
							><Icon icon="share" />{m.share_native()}</button
						>
					</li>
				{/if}
				{#if onLocate}
					<li>
						<button type="button" role="menuitem" onclick={onLocate}
							><Icon icon="arrow-down" />{m.track_card_locate_in_list()}</button
						>
					</li>
				{/if}
				<li>
					{#if isRealTrack}
						<a href={permalink} role="menuitem"><Icon icon="circle-info" />{m.track_go_to()}</a>
					{:else if track.url}
						<a
							href={track.url}
							target="_blank"
							rel="noopener noreferrer nofollow ugc"
							role="menuitem"><Icon icon="circle-info" />{m.track_card_open_video()}</a
						>
					{/if}
				</li>
				{#if editable}
					<li>
						<button type="button" role="menuitem" onclick={editTrack}
							><Icon icon="edit" />{m.common_edit()}</button
						>
					</li>
					<li>
						<button
							type="button"
							role="menuitem"
							data-danger
							onclick={() => {
								menu?.close()
								showDeleteDialog = true
							}}><Icon icon="delete" />{m.common_delete()}</button
						>
					</li>
				{/if}
			</menu>
		</PopoverMenu>
	{/if}
	{#if showDeleteDialog}
		<Dialog bind:showModal={showDeleteDialog}>
			{#snippet header()}
				<h2>{m.common_delete()}</h2>
			{/snippet}
			<p>{m.track_delete_confirm({title: track.title})}</p>
			{#if deleteError}<p role="alert">{deleteError}</p>{/if}
			<r4-track-card preview>
				<article>
					{#if ytid && showImage && appState.show_track_artwork}
						{@render artwork()}
					{/if}
					{@render text(false)}
				</article>
			</r4-track-card>
			{#snippet footer()}
				<menu>
					<li>
						<button type="button" data-danger onclick={handleDelete}>{m.common_confirm()}</button>
					</li>
					<li>
						<button type="button" onclick={() => (showDeleteDialog = false)}
							>{m.common_cancel()}</button
						>
					</li>
				</menu>
			{/snippet}
		</Dialog>
	{/if}
	{@render children?.(track)}
</r4-track-card>

<style>
	r4-track-card {
		display: flex;
		align-items: center;
		container-type: inline-size;
		background: var(--color-interface-elevated);
		border: 1px solid var(--color-interface-border);
		border-radius: var(--border-radius);
		transition:
			background var(--duration-2),
			border-color var(--duration-2);

		&:hover {
			background: var(--gray-3);
			border-color: var(--color-control-border-hover);
		}
	}

	article {
		flex: 1;
		display: flex;
		flex-flow: row nowrap;
		gap: 0 var(--space-2);
		padding: var(--space-2) 0 var(--space-2) var(--space-2);
		line-height: 1.2;
		min-height: var(--track-card-min-height);
		min-width: 0;
		cursor: var(--interactive-cursor, pointer);
	}

	img {
		aspect-ratio: 1;
		width: var(--track-artwork-size);
		object-fit: cover;
		align-self: center;
		border-radius: var(--media-radius);
		flex-shrink: 0;
	}

	/* The artwork doubles as a play button */
	article > button {
		padding: 0;
		border: 0;
		background: transparent;
		min-width: 0;
		min-height: 0;
		border-radius: var(--media-radius);
		overflow: hidden;

		&:is(:hover, :focus, :active) {
			background: transparent;
			border-color: transparent;
			outline: none;
		}
	}

	hgroup {
		display: flex;
		flex-flow: column;
		justify-content: center;
		min-width: 0;
		margin: 0;
	}

	h3 {
		font-size: var(--font-4);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;

		&[data-locatable='true'] {
			cursor: var(--interactive-cursor, pointer);
		}

		a {
			text-decoration: none;
			color: inherit;
		}
	}

	h3 + p {
		line-height: 1.2;
		color: light-dark(var(--gray-11), var(--gray-10));
		white-space: nowrap;
		padding: 2px 1px;
		overflow-x: auto;
		scrollbar-width: thin;
		/* only show the scrollbar on hover */
		scrollbar-color: transparent transparent;
		transition: scrollbar-color var(--duration-2);

		&:hover {
			scrollbar-color: var(--gray-1) transparent;
		}
	}

	aside {
		margin-inline-start: auto;
		display: flex;
		flex-flow: column;
		place-items: flex-end;
		place-content: center;
		gap: var(--space-1);

		a {
			display: flex;
			align-items: center;
		}
	}

	@container (width < 80ch) {
		aside small {
			display: none;
		}
	}

	/* Playing: no fill, no border, the accent title is the only cue */
	r4-track-card[active='true'] {
		background: transparent;
		border-color: transparent;

		h3 {
			color: var(--accent-9);
		}
	}

	/* Keyboard-current row */
	r4-track-card[selected='true'] {
		background: var(--gray-3);
		border-color: var(--accent-7);
		--tag-bg: var(--gray-4);
		--tag-bg-hover: var(--gray-5);
		--tag-bg-active: var(--gray-6);
	}

	/* The ⋯ trigger: the placeholder button, then the real one in the popover menu */
	r4-track-card > button,
	r4-track-card > :global(r4-popover-menu > button) {
		margin: 0.2em;
		background: transparent;
		border-color: transparent;

		&::before {
			content: '';
			width: 18px;
			height: 18px;
			background: currentColor;
			mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M18.006 11.994L18.006 12.006M12.006 11.994L12.006 12.006M6.006 11.994L6.006 12.006' stroke='black' stroke-width='4' stroke-linecap='round'/%3E%3C/svg%3E");
		}

		&:hover {
			border-color: var(--color-control-border);
		}
	}

	r4-track-card[preview] {
		margin-block: var(--space-2);

		article {
			cursor: default;
		}

		:global(a) {
			pointer-events: none;
		}
	}

	[data-danger] {
		color: var(--color-red);
	}
</style>
