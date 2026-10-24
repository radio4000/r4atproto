<script>
	import {onMount, untrack} from 'svelte'
	import {MediaQuery} from 'svelte/reactivity'
	import ui from '#lib/config/ui.json' with {type: 'json'}
	import {channelHref, channelTracksHref} from '#lib/links.js'
	import IconR4 from '#lib/components/icon-r4.svelte'
	import {
		next,
		play,
		previous,
		togglePlayPause,
		toggleDeckCompact,
		getUserInitiatedPlay,
		setUserInitiatedPlay,
		resyncAutoRadio,
		leaveAutoRadio,
		rejoinAutoRadio,
		recordSeekPosition,
		toggleShuffle
	} from '#lib/api.js'
	import {requestPlaybackWakeLock, releasePlaybackWakeLock} from '#lib/wake-lock.js'
	import {requestAudioKeepAlive, releaseAudioKeepAlive} from '#lib/player/audio-keepalive.js'
	import {getActiveQueue, canPlay, canPrev, canNext} from '#lib/player/queue.js'
	import {sortedListeningDeckIds, sortedDeckIds, isGroupControlDeck} from '#lib/deck.js'
	import {playbackState, toAutoTracks, AUTO_RADIO_SYNC_GRACE_MS} from '#lib/player/auto-radio.js'
	import {getBroadcastingChannelId, notifyBroadcastState} from '#lib/broadcast.js'
	import {calculateSeekTime, DRIFT_TOLERANCE_SECONDS} from '#lib/broadcast-utils.js'
	import {createDeckDisplay} from '#lib/player/deck-display.svelte.js'
	import {createMediaSession} from '#lib/player/media-session.svelte.js'
	import {createStallRecovery} from '#lib/player/stall-recovery.svelte.js'
	import {appState, canEditChannel, deckAccent} from '#lib/app-state.svelte.js'
	import ChannelMicroCard from '#lib/components/channel-micro-card.svelte'
	import Icon from '#lib/components/icon.svelte'
	import AutoRadioButton from '#lib/components/auto-radio-button.svelte'
	import PopoverMenu from '#lib/components/popover-menu.svelte'
	import DeckMenu from '#lib/components/deck-menu.svelte'
	import SpeedControl from '#lib/components/speed-control.svelte'
	import VolumeControl from '#lib/components/volume-control.svelte'
	import {tooltip} from '#lib/components/tooltip-attachment.svelte.js'
	import {shortcutHint} from '#lib/keyboard.js'
	import {logger} from '#lib/logger.js'
	import {parseUrl} from 'media-now/parse-url'
	import {tracksCollection, updateTrack, watchTracks} from '#lib/collections/tracks.js'
	import {extractHashtags, HASH_PREFIX_REGEX, isMobileViewport} from '#lib/utils.js'
	import PlayerProgress from '#lib/components/player-progress.svelte'
	import Tag from '#lib/components/tag.svelte'
	import TrackCard from '#lib/components/track-card.svelte'
	import * as m from '#lib/paraglide/messages.js'
	import {
		trackAutoRadioPresence,
		untrackAutoRadioPresence,
		trackBroadcastPresence,
		untrackBroadcastPresence
	} from '#lib/presence.svelte.js'
	/** @typedef {import('#lib/types.js').Track} Track */
	/** @typedef {import('#lib/types.js').Channel} Channel */

	const log = logger.ns('player').seal()

	// Lazy: these define custom elements at module scope, which needs `HTMLElement`.
	onMount(async () => {
		await Promise.all([
			import('media-chrome'),
			import('#lib/youtube-video-custom-element.js'),
			import('#lib/soundcloud-player-custom-element.js')
		])
	})

	/** @type {{deckId: number, deckEl?: HTMLElement, children?: import('svelte').Snippet, scrollToActive?: (() => void) | undefined}} */
	let {deckId, deckEl, children, scrollToActive} = $props()

	let deck = $derived(appState.decks[deckId])
	const mobile = new MediaQuery(`(max-width: ${ui.mobileBreakpoint}px)`)
	/** Records on the PDS, not ephemeral tracks (e.g. Discogs videos) */
	const isRecord = (id) => Boolean(id?.startsWith('at://'))
	let isActiveDeck = $derived(appState.active_deck_id === deckId)
	let hasMultipleDecks = $derived(Object.keys(appState.decks).length > 1)
	let listeningDeckIds = $derived(sortedListeningDeckIds(appState.decks))
	let isListeningGroupControlDeck = $derived(isGroupControlDeck(deck, deckId, listeningDeckIds))
	let hasListeningMultiDeck = $derived(listeningDeckIds.length > 1)
	let deckIds = $derived(sortedDeckIds(appState.decks))
	let accentColor = $derived(deckAccent(deckIds, deckId))

	// Both media player elements
	let youtubePlayer = $state()
	let soundcloudPlayer = $state()
	let audioPlayer = $state()

	// deckId never changes for this component instance — it's rendered inside
	// an {#each ... (deckId)} keyed block, so a changed deckId remounts it.
	const display = createDeckDisplay(untrack(() => deckId))
	const track = $derived(display.track)
	const channel = $derived(display.channel)
	const displayTrack = $derived(display.displayTrack)
	const displayChannel = $derived(display.displayChannel)

	let src = $derived(track?.url)
	let provider = $derived(
		track?.provider || (track?.url ? parseUrl(track.url)?.provider : null) || null
	)
	let useNativeAudio = $derived(provider === 'file')
	let mediaElement = $derived.by(() => {
		if (provider === 'youtube') return youtubePlayer
		if (provider === 'soundcloud') return soundcloudPlayer
		if (useNativeAudio) return audioPlayer
		return undefined
	})
	let activeQueue = $derived(getActiveQueue(deck))
	let canPlayFromQueue = $derived(canPlay(activeQueue, track?.id))
	let canPrevFromQueue = $derived(canPrev(activeQueue, track?.id))
	let canNextFromQueue = $derived(canNext(activeQueue, track?.id))

	// Lock-screen/notification controls and background-stall recovery. Pure
	// stability workarounds — quarantined in their own modules, see docs/player.md.
	const mediaSession = createMediaSession(
		untrack(() => deckId),
		{
			get mediaElement() {
				return mediaElement
			},
			get provider() {
				return provider
			},
			get displayTrack() {
				return displayTrack
			},
			get displayChannel() {
				return displayChannel
			},
			get canPrev() {
				return canPrevFromQueue
			},
			get canNext() {
				return canNextFromQueue
			}
		}
	)
	createStallRecovery(
		untrack(() => deckId),
		{
			get mediaElement() {
				return mediaElement
			},
			restoreVolume: applyInitialVolume
		}
	)

	// Track list for drift detection. Resolve each id via O(1) Map lookups on the
	// collection; watchTracks() re-runs this on any track change without building a
	// d2ts inArray pipeline over the whole playlist. See docs/tanstack.md.
	const syncAutoTracks = $derived.by(() => {
		watchTracks()
		const state = tracksCollection.state
		return toAutoTracks(
			/** @type {import('#lib/types.js').Track[]} */
			((deck?.playlist_tracks ?? []).map((id) => state.get(id)).filter(Boolean))
		)
	})
	const syncTotalDuration = $derived(syncAutoTracks.reduce((sum, t) => sum + t.duration, 0))

	let deckMenu = $state(/** @type {{close: () => void} | undefined} */ (undefined))

	let didPlay = $state(false)
	let userHasPlayed = $state(false)
	const isListeningToBroadcast = $derived(Boolean(deck?.listening_to_channel_id))
	const isSyncedListeningMode = $derived(Boolean(isListeningToBroadcast || deck?.auto_radio))
	let showDeckActions = $derived(!isListeningToBroadcast || isListeningGroupControlDeck)

	const listenSlug = $derived(display.listenSlug)
	const broadcastSlug = $derived(display.broadcastSlug)

	const broadcastingChannel = $derived(display.broadcasterChannel)
	const headerChannel = $derived(display.headerChannel)
	const secondaryHeaderChannel = $derived(display.secondaryHeaderChannel)

	const headerTags = $derived.by(() => {
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- local dedupe, not reactive state
		const tags = new Set(
			extractHashtags(deck?.playlist_title ?? '').map((tag) =>
				tag.replace(HASH_PREFIX_REGEX, '').toLowerCase()
			)
		)
		for (const source of deck?.view?.sources ?? []) {
			for (const tag of source?.tags ?? []) tags.add(tag.toLowerCase())
		}
		return Array.from(tags, (value) => ({
			value: `#${value}`,
			href: deck?.playlist_slug ? channelTracksHref(deck.playlist_slug, {tags: value}) : undefined
		}))
	})

	// Track previous track ID to detect changes for autoplay
	let prevTrackId = $state(/** @type {string|undefined} */ (undefined))

	$effect(() => {
		if (!track) return // Wait for data to load

		const trackChanged = track.id !== prevTrackId
		if (!trackChanged) return

		prevTrackId = track.id

		// Check if a user-initiated play flag was set
		if (getUserInitiatedPlay(deckId) && !userHasPlayed) {
			userHasPlayed = true
			setUserInitiatedPlay(deckId, false)
			log.log('Setting userHasPlayed=true for user-initiated track change')
		}

		// Auto-play if we were already playing when track changed
		if (didPlay) {
			log.log('Auto-playing next track')
			play(deckId).catch((error) => log.warn('Playback failed:', error))
		}
	})

	function handlePlay() {
		log.log('handlePlay', {
			mediaDuration: mediaElement?.duration,
			trackDuration: track?.duration,
			canEdit: channel ? canEditChannel(channel.id) : false
		})
		didPlay = true
		userHasPlayed = true
		if (deck) deck.is_playing = true
		if (deck && mediaElement && 'playbackRate' in mediaElement) {
			mediaElement.playbackRate = deck.speed ?? 1
		}
		if (mediaElement) recordSeekPosition(deckId, mediaElement.currentTime ?? 0)
		// Update track duration if missing (only for owned channels, once per track)
		if (
			track &&
			isRecord(track.id) &&
			channel &&
			canEditChannel(channel.id) &&
			!track.duration &&
			mediaElement?.duration
		) {
			const duration = Math.round(mediaElement.duration)
			const existing = tracksCollection.state.get(track.id)
			if (duration > 0 && !existing?.duration) {
				updateTrack(channel, track.id, {duration})
			}
		}
	}

	/** A flagged track that plays again clears its own flag; owner only, like handleError. */
	function handlePlaying() {
		// `play` can precede buffering; reclaim controls when playback actually resumes too.
		mediaSession.reassert()
		const id = track?.id
		if (!id || !isRecord(id) || !channel || !canEditChannel(channel.id)) return
		if (!tracksCollection.state.get(id)?.playback_error) return
		updateTrack(channel, id, {playback_error: null}).catch((e) =>
			log.error('playback_error clear failed', e)
		)
	}

	function handlePause() {
		log.log('handlePause')
		if (deck) deck.is_playing = false
		if (mediaElement) recordSeekPosition(deckId, mediaElement.currentTime ?? 0)
	}

	/** @param {any} event */
	function handleError(event) {
		const error = event.target.error
		if (error == null) {
			log.warn('Error event with no error object')
			return
		}
		const code = typeof error === 'number' ? error : error.code
		let msg = ''
		// Persist durable failures only: YouTube bad id, missing/private, or embed blocked.
		if (provider === 'youtube' && [2, 100, 101, 150].includes(code)) msg = `youtube:${code}`
		else if (provider === 'soundcloud' && code != null) msg = `soundcloud:${code}`
		log.warn('Playback error', {provider, code, trackId: track?.id})
		const id = track?.id
		if (msg && id && isRecord(id) && channel && canEditChannel(channel.id)) {
			updateTrack(channel, id, {playback_error: msg})
				.then(() => log.log('playback_error saved', {id, msg}))
				.catch((e) => log.error('playback_error save failed', e))
		}
		next(deckId, 'youtube_error')
	}

	function handleEndTrack() {
		if (deck?.listening_to_channel_id) return
		next(deckId, 'track_completed')
	}

	function applyInitialVolume() {
		if (!mediaElement || !deck) return
		mediaElement.volume = deck.volume
		mediaElement.muted = deck.muted ?? false
	}

	function handleVolumeChange(e) {
		// YouTube/SoundCloud wrappers dispatch synthetic volumechange events.
		// Accept those when they originate from the active media element.
		const fromProviderElement = e?.target && e.target === mediaElement
		if (!e.isTrusted && !fromProviderElement) return
		const {volume} = e.target
		if (!Number.isFinite(volume)) return
		if (!deck) return
		const muted = Boolean(e.target.muted)
		if (deck.volume === volume && deck.muted === muted) return
		deck.volume = volume
		// Don't persist muted=true when it's a side-effect of volume reaching 0
		if (volume > 0 || !muted) deck.muted = muted
		log.log('volumeChange', {volume, muted})
		const broadcastingChannelId = getBroadcastingChannelId()
		if (broadcastingChannelId) notifyBroadcastState(broadcastingChannelId)
	}

	function handleSeeked() {
		if (!mediaElement) return
		recordSeekPosition(deckId, mediaElement.currentTime ?? 0)
	}

	$effect(() => {
		if (deck?.video_mix && !isListeningToBroadcast) deck.video_mix = false
		if (hasListeningMultiDeck) return
		for (const id of listeningDeckIds) {
			const listeningDeck = appState.decks[id]
			if (listeningDeck?.video_mix) listeningDeck.video_mix = false
		}
	})

	$effect(() => {
		const el = mediaElement
		if (el) {
			untrack(() => applyInitialVolume())
		}
	})

	const mediaControllerId = $derived(`r5-deck-${deckId}`)

	// Track progress from the media element directly (bypasses media-chrome's
	// external mediacontroller association which doesn't work with Svelte 5).
	// Written to deck state so compact bar can read without its own listeners.
	let mediaDuration = $derived(deck?.media_duration ?? NaN)
	let mediaCurrentTime = $derived(deck?.media_current_time ?? 0)

	// Clear stale duration when track changes so the previous track's duration doesn't show
	$effect(() => {
		void deck?.playlist_track
		if (deck) {
			deck.media_duration = NaN
			deck.media_current_time = 0
		}
	})

	$effect(() => {
		const trackId = deck?.playlist_track
		if (!trackId) return
		const el = mediaElement
		if (!el) return
		let prevTime = el.currentTime ?? 0
		const onTime = () => {
			if (!deck || deck.playlist_track !== trackId) return
			const currentTime = el.currentTime ?? 0
			const delta = currentTime - prevTime
			if (delta > 0 && delta < 3) {
				deck.ms_listened = (deck.ms_listened ?? 0) + delta * 1000
			}
			prevTime = currentTime
			deck.media_current_time = currentTime
		}
		const onDuration = () => {
			if (!deck || deck.playlist_track !== trackId) return
			const d = el.duration
			deck.media_duration = Number.isFinite(d) && d > 0 ? d : NaN
		}
		el.addEventListener('timeupdate', onTime)
		el.addEventListener('durationchange', onDuration)
		el.addEventListener('loadedmetadata', onDuration)
		// Seed initial values
		onTime()
		onDuration()
		return () => {
			el.removeEventListener('timeupdate', onTime)
			el.removeEventListener('durationchange', onDuration)
			el.removeEventListener('loadedmetadata', onDuration)
		}
	})

	// Apply speed to media element
	$effect(() => {
		const el = mediaElement
		const speed = deck?.speed ?? 1
		if (el && 'playbackRate' in el) {
			el.playbackRate = speed
		}
	})

	// Wake lock — keep the screen on while this deck is playing. Ref-counted across
	// decks in the module itself, so multiple simultaneously-playing decks don't
	// release each other's lock.
	$effect(() => {
		if (!deck?.is_playing) return
		requestPlaybackWakeLock(deckId)
		return () => releasePlaybackWakeLock(deckId)
	})

	// Keep the page audible across track changes on a locked Android screen (see module).
	$effect(() => {
		if (!deck?.is_playing) return
		requestAudioKeepAlive(deckId)
		return () => releaseAudioKeepAlive(deckId)
	})

	// Auto-radio drift — re-evaluates on every timeupdate (~250ms while playing)
	$effect(() => {
		if (!deck?.auto_radio || deck.auto_radio_rotation_start == null) return
		const t = mediaCurrentTime
		// Skip while the join/resync seek is still landing. joinAutoRadio/resyncAutoRadio
		// set auto_radio_drifted=false immediately, but the seek settles asynchronously —
		// evaluating in between flags a false positive on the very next timeupdate.
		if (Date.now() - (deck.auto_radio_synced_at ?? 0) < AUTO_RADIO_SYNC_GRACE_MS) return
		if (t < DRIFT_TOLERANCE_SECONDS) return
		const snap = playbackState(
			syncAutoTracks,
			syncTotalDuration,
			deck.auto_radio_rotation_start,
			Date.now()
		)
		const drifted =
			!snap ||
			deck.playlist_track !== snap.currentTrack.id ||
			Math.abs(t - snap.offsetSeconds) > DRIFT_TOLERANCE_SECONDS
		untrack(() => {
			if (deck) deck.auto_radio_drifted = drifted
		})
	})

	// Presence tracking — driven by what this deck is actively doing
	$effect(() => {
		const autoSlug = deck?.auto_radio ? deck.playlist_slug : undefined

		if (autoSlug) {
			untrack(() => trackAutoRadioPresence(autoSlug, deck.view))
			return () => untrackAutoRadioPresence(autoSlug)
		}
		if (listenSlug) {
			untrack(() => trackBroadcastPresence(listenSlug))
			return () => untrackBroadcastPresence(listenSlug)
		}
		if (broadcastSlug) {
			untrack(() => trackBroadcastPresence(broadcastSlug))
			return () => untrackBroadcastPresence(broadcastSlug)
		}
	})

	// Broadcast drift — O(1) arithmetic per tick
	$effect(() => {
		if (!deck?.listening_to_channel_id) return
		const t = mediaCurrentTime
		const tr = track
		if (!tr) return
		const expected = calculateSeekTime(deck, tr)
		if (expected == null) return
		const drifted = Math.abs(t - expected) > DRIFT_TOLERANCE_SECONDS
		untrack(() => {
			if (deck) deck.listening_drifted = drifted
		})
	})
</script>

<r4-player video-mix={Boolean(deck?.video_mix && isListeningToBroadcast && hasListeningMultiDeck)}>
	<!-- 1. Top bar: deck id, channel, layout controls -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<header
		onclick={(e) => {
			appState.active_deck_id = deckId
			// Mobile: the expanded deck covers the screen, so following the channel link
			// would navigate invisibly behind it. Collapse to the compact bar first.
			if (
				isMobileViewport() &&
				e.target instanceof Element &&
				e.target.closest('r4-channel-micro-card')
			) {
				toggleDeckCompact(deckId)
			}
		}}
	>
		{#if hasMultipleDecks}
			<r4-deck-id active={isActiveDeck} style:color={isActiveDeck ? accentColor : undefined}>
				<IconR4 />
			</r4-deck-id>
		{/if}
		{#if headerChannel}
			<r4-player-channel>
				{@render headerChannelCard(headerChannel)}
				{#if secondaryHeaderChannel}
					{@render headerChannelCard(secondaryHeaderChannel)}
				{/if}
				{#each headerTags as tag (tag.value)}
					<Tag href={tag.href} value={tag.value} {deckId}>{tag.value}</Tag>
				{/each}
			</r4-player-channel>
		{/if}
		<menu>
			{#if showDeckActions}
				<li>
					<PopoverMenu align="right" closeOnClick={false} bind:this={deckMenu}>
						{#snippet trigger()}
							<Icon icon="options-horizontal" />
						{/snippet}
						<DeckMenu
							{deckId}
							{deckEl}
							autoRadioAvailable={display.autoRadioAvailable}
							closeMenu={() => deckMenu?.close()}
						/>
					</PopoverMenu>
				</li>
			{/if}
			{#if mobile.current && deck?.expanded}
				<!-- Mobile fullscreen: collapse back to the compact bar -->
				<li>
					<button
						onclick={() => toggleDeckCompact(deckId)}
						aria-label={m.player_tooltip_compact()}
						{@attach tooltip({
							content: m.player_tooltip_compact() + shortcutHint('toggleCompactDeck'),
							position: 'top'
						})}
					>
						<Icon icon="arrow-down" />
					</button>
				</li>
			{:else if showDeckActions}
				<li>
					<button
						onclick={() => toggleDeckCompact(deckId)}
						aria-label={m.player_tooltip_compact()}
						{@attach tooltip({
							content: m.player_tooltip_compact() + shortcutHint('toggleCompactDeck'),
							position: 'top'
						})}
					>
						<Icon icon="deck-panel" />
					</button>
				</li>
			{/if}
		</menu>
	</header>

	<!-- 2. Media player -->
	<media-controller id={mediaControllerId} audio={useNativeAudio} data-clickable="true">
		{#if provider === 'youtube'}
			<youtube-video
				slot="media"
				bind:this={youtubePlayer}
				{src}
				autoplay={userHasPlayed || undefined}
				onplay={handlePlay}
				onplaying={handlePlaying}
				onpause={handlePause}
				onseeked={handleSeeked}
				onended={handleEndTrack}
				onerror={handleError}
				onvolumechange={handleVolumeChange}
			></youtube-video>
		{:else if provider === 'soundcloud'}
			<soundcloud-player
				slot="media"
				bind:this={soundcloudPlayer}
				{src}
				autoplay={userHasPlayed || undefined}
				onplay={handlePlay}
				onplaying={handlePlaying}
				onpause={handlePause}
				onseeked={handleSeeked}
				onended={handleEndTrack}
				onerror={handleError}
				onvolumechange={handleVolumeChange}
			></soundcloud-player>
		{:else if track?.url}
			<audio
				slot="media"
				bind:this={audioPlayer}
				{src}
				controls
				autoplay={userHasPlayed || undefined}
				preload="metadata"
				onplay={handlePlay}
				onplaying={handlePlaying}
				onpause={handlePause}
				onseeked={handleSeeked}
				onended={handleEndTrack}
				onerror={handleError}
				onvolumechange={handleVolumeChange}
			></audio>
		{/if}
		<media-loading-indicator slot="centered-chrome"></media-loading-indicator>
	</media-controller>
	{#if deck?.hide_video_player}
		<r4-player-placeholder aria-label="Radio4000" data-clickable="true">
			<IconR4 />
		</r4-player-placeholder>
	{/if}

	<!-- 3. Queue (injected by the deck) -->
	{@render children?.()}

	<section>
		{#if appState.show_track_range_control !== false && displayTrack}
			<PlayerProgress
				currentTime={mediaCurrentTime}
				{mediaDuration}
				trackDuration={track?.duration}
				isPlaying={Boolean(deck?.is_playing)}
				disabled={isListeningToBroadcast}
				onseek={(val) => {
					if (deck) deck.media_current_time = val
					if (mediaElement) mediaElement.currentTime = val
				}}
			/>
		{/if}

		<!-- 4. Current track -->
		<footer onclick={() => (appState.active_deck_id = deckId)}>
			{#if isListeningToBroadcast && broadcastingChannel}
				{#if displayTrack}
					<r4-player-listening-track>
						<TrackCard
							track={displayTrack}
							{deckId}
							canEdit={Boolean(displayChannel && canEditChannel(displayChannel.id))}
							disableDoubleClickPlay={true}
							linkTitleToTrack={true}
							menuValign="top"
							menuAlign="end"
						/>
					</r4-player-listening-track>
				{/if}
			{:else if displayTrack}
				<TrackCard
					track={displayTrack}
					{deckId}
					canEdit={Boolean(channel && canEditChannel(channel.id))}
					menuValign="top"
					menuAlign="end"
					onLocate={isSyncedListeningMode ? undefined : scrollToActive}
					disableDoubleClickPlay={isSyncedListeningMode}
					linkTitleToTrack={isSyncedListeningMode}
				/>
			{/if}
		</footer>

		{#if !isListeningToBroadcast || deck?.auto_radio}
			<menu>
				{#if !isListeningToBroadcast && !deck?.auto_radio}
					{@render btnPrev()}
					{@render btnPlay()}
					{@render btnNext()}
					<VolumeControl {deckId} />
					<SpeedControl {deckId} {provider} />
					{#if activeQueue.length > 2}
						<button
							onclick={() => toggleShuffle(deckId)}
							aria-pressed={Boolean(deck?.shuffle)}
							{@attach tooltip({
								content: m.player_tooltip_shuffle() + shortcutHint('toggleShuffle')
							})}
						>
							<Icon icon="shuffle" />
						</button>
					{/if}
					{#if display.autoRadioAvailable}
						<AutoRadioButton size={14} onclick={() => rejoinAutoRadio(deckId)} />
					{/if}
				{:else if deck?.auto_radio}
					{@render btnPlay()}
					<VolumeControl {deckId} />
					<AutoRadioButton
						live
						drifted={!!deck?.auto_radio_drifted}
						size={14}
						onclick={() =>
							deck?.auto_radio_drifted ? resyncAutoRadio(deckId) : leaveAutoRadio(deckId)}
					/>
				{/if}
			</menu>
		{/if}
	</section>
</r4-player>

{#snippet headerChannelCard(/** @type {Channel} */ ch)}
	<ChannelMicroCard channel={ch} href={channelHref(ch.slug)} />
{/snippet}

{#snippet btnPrev()}
	<button
		onclick={() => previous(deckId, 'user_prev')}
		disabled={!canPrevFromQueue}
		aria-label={m.player_tooltip_prev()}
		{@attach tooltip({content: m.player_tooltip_prev() + shortcutHint('previousTrack')})}
	>
		<Icon icon="previous-fill" />
	</button>
{/snippet}

{#snippet btnNext()}
	<button
		onclick={() => next(deckId, 'user_next')}
		disabled={!canNextFromQueue}
		aria-label={m.player_tooltip_next()}
		{@attach tooltip({content: m.player_tooltip_next() + shortcutHint('nextTrack')})}
	>
		<Icon icon="next-fill" />
	</button>
{/snippet}

{#snippet btnPlay()}
	<button
		onclick={() => togglePlayPause(deckId)}
		disabled={!canPlayFromQueue}
		aria-pressed={Boolean(deck?.is_playing)}
		aria-label={deck?.is_playing ? m.player_tooltip_pause() : m.player_tooltip_play()}
		{@attach tooltip({
			content:
				(deck?.is_playing ? m.player_tooltip_pause() : m.player_tooltip_play()) +
				shortcutHint('togglePlayPause')
		})}
	>
		<Icon icon={deck?.is_playing ? 'pause' : 'play-fill'} />
	</button>
{/snippet}

<style>
	r4-player {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 0;
	}

	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
		padding: var(--space-2);
		cursor: var(--interactive-cursor, pointer);

		> menu {
			align-items: center;
			flex-shrink: 0;
			margin-inline-start: auto;
		}
	}

	r4-deck-id {
		display: flex;
		align-items: center;
		color: var(--gray-9);

		&[active='true'] {
			color: var(--accent-9);
		}
	}

	r4-player-channel {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: var(--space-1);
		min-width: 0;
		max-width: min(64vw, 26rem);
		/* Tags are em-sized; match the micro card so the row reads at one scale */
		font-size: var(--font-2);

		:global(r4-channel-micro-card) {
			flex: 0 1 auto;
			max-width: 100%;
			background: none;
			border: none;
		}
	}

	media-controller {
		flex: 1 0 auto;
		width: 100%;
		max-height: 25dvh;
		aspect-ratio: 16 / 9;
		background: black;
		transition:
			flex var(--duration-2) var(--ease-out),
			max-height var(--duration-2) var(--ease-out);

		&[audio='true'] {
			aspect-ratio: auto;
		}

		:global(:is(youtube-video, soundcloud-player)) {
			display: block;
			width: 100%;
			height: 100%;
			min-height: 0;
		}

		/* The YouTube API may set explicit iframe dimensions */
		:global(youtube-video iframe) {
			width: 100% !important;
			height: 100% !important;
			max-height: none !important;
		}

		audio {
			width: 100%;
		}
	}

	r4-player-placeholder {
		display: flex;
		align-items: center;
		justify-content: center;
		flex: 1 1 auto;
		min-height: 0;
		color: color-mix(in srgb, var(--gray-9) 55%, transparent);

		:global(svg) {
			width: min(24%, 6rem);
			height: auto;
			opacity: 0.9;
		}
	}

	/* Listening and auto-radio decks let the media fill the deck */
	:global(r4-deck:is([listening='true'], [auto='true'])) media-controller {
		height: 100%;
		min-height: 0;
		max-height: none;
		aspect-ratio: auto;
	}

	section {
		display: flex;
		flex-direction: column;
		margin-top: auto;
		border-top: 1px solid var(--color-interface-border);

		@media (max-width: 768px) {
			margin-top: 0;
		}

		> menu {
			align-items: center;
			flex-wrap: nowrap;
			gap: var(--space-1);
			min-width: 0;
			padding: var(--space-2);
			/* Only the controls row is a container, so track cards keep their own rules */
			container-type: inline-size;
			flex-wrap: wrap;

			/* Volume and speed split the space the buttons leave */
			:global(:is(r4-volume-control, r4-speed-control)) {
				flex: 1 1 0;
			}
		}
	}

	:global(r4-deck[listening='true']) section {
		margin-top: 0;
	}

	/* Narrow decks: transport buttons on one line, both ranges on the next */
	@container (max-width: 520px) {
		section > menu::before {
			content: '';
			flex-basis: 100%;
			order: 1;
		}

		section > menu :global(:is(r4-volume-control, r4-speed-control)) {
			order: 2;
		}
	}

	footer {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		cursor: var(--interactive-cursor, pointer);

		:global(r4-track-card) {
			flex: 1 1 auto;
			min-width: 0;
		}
	}

	r4-player-listening-track {
		display: flex;
		flex: 1 1 auto;
		min-width: 0;
		background: var(--accent-2);
		border-radius: var(--border-radius);
	}
</style>
