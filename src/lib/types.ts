/**
 * Domain types. Same shapes as r4-svelte, keyed by atproto identifiers:
 * a channel is an account (id = DID, slug = handle), a track is a
 * radio.4000.track record (id = at:// URI).
 */

export interface Channel {
	/** DID of the account */
	id: string
	/** handle of the account */
	slug: string
	name: string
	description?: string | null
	/** image URL: the channel image, else the Bluesky avatar */
	image?: string | null
	url?: string | null
	latitude?: number | null
	longitude?: number | null
	theme?: import('#lib/atproto/records.js').ChannelTheme
	/** slug on radio4000.com, when imported from there */
	r4_slug?: string | null
	/** true when the account has a radio.4000.channel record */
	has_record?: boolean
	created_at?: string | null
	updated_at?: string | null
	track_count?: number | null
	latest_track_at?: string | null
}

/** Minimal channel handle for play/track APIs — enough to identify (id) and route (slug). */
export type ChannelRef = Pick<Channel, 'id' | 'slug'>

export interface Track {
	/** at:// URI of the record */
	id: string
	/** DID of the channel */
	did: string
	/** handle of the channel */
	slug: string
	url: string
	title: string
	description?: string | null
	discogs_url?: string | null
	duration?: number | null
	playback_error?: string | null
	tags: string[]
	mentions: string[]
	provider?: string | null
	media_id?: string | null
	r4_id?: string | null
	created_at: string
	updated_at?: string | null
}

export interface DiscogsTracklistItem {
	position: string
	type_: string
	title: string
	duration: string
}

export interface DiscogsVideo {
	uri: string
	title: string
	description: string
	duration: number
	embed: boolean
}

export interface DiscogsResource {
	artists_sort?: string
	artists?: Array<{name: string}>
	title?: string
	year?: number
	released_formatted?: string
	country?: string
	genres?: string[]
	styles?: string[]
	labels?: Array<{name: string; catno?: string}>
	formats?: Array<{name: string; qty: string; descriptions?: string[]}>
	community?: {have: number; want: number; rating: {count: number; average: number}}
	tracklist?: DiscogsTracklistItem[]
	videos?: DiscogsVideo[]
	uri?: string
	thumb?: string
	_meta?: {fetchedAt?: string; sourceUrl?: string}
}

export interface TrackMetadataFields {
	youtube_data?: {id?: string; duration?: number; [key: string]: unknown}
	musicbrainz_data?: object
	discogs_data?: DiscogsResource
}

// Track joined with metadata from TrackMeta collection
export interface TrackWithMeta extends Track, TrackMetadataFields {}

export interface Deck {
	id: number
	playlist_title?: string
	playlist_slug?: string
	playlist_track?: string
	playlist_tracks: string[]
	playlist_tracks_shuffled: string[]
	/** Session-only queue filter (search, #tags, @mention), set from the queue panel. */
	queue_filter?: {search: string; tags: string[]; mention: string}
	/** Track IDs matching queue_filter; next/prev stay within them (plus the current track). */
	playlist_tracks_filtered?: string[]
	is_playing: boolean
	shuffle: boolean
	volume: number
	muted?: boolean
	hide_video_player: boolean
	video_mix?: boolean
	compact: boolean
	expanded: boolean
	hide_queue_panel: boolean
	queue_panel_width?: number
	broadcasting_channel_id?: string
	listening_to_channel_id?: string
	auto_radio?: boolean
	auto_radio_drifted?: boolean
	view?: import('#lib/views.js').View
	auto_radio_rotation_start?: number
	/** Epoch ms of the last join/resync — drift detection stays quiet for a grace
	 *  window after it while the seek lands. */
	auto_radio_synced_at?: number
	listening_drifted?: boolean
	play_id?: string
	track_played_at?: string | null
	seeked_at?: string | null
	seek_position?: number | null
	speed?: number
	media_current_time?: number
	media_duration?: number
	ms_listened?: number
}

export interface AppState {
	id: number
	decks: Record<number, Deck>
	next_deck_id: number
	active_deck_id: number
	theme?: string
	custom_css_variables: Record<string, string>
	channels_display: 'grid' | 'list' | 'map' | 'infinite' | 'tuner'
	channels_filter: string
	channels_order: 'updated' | 'created' | 'name' | 'tracks' | 'shuffle'
	channels_order_direction: 'asc' | 'desc'
	/** the signed-in account's channel */
	channel?: Channel
	/** the signed-in account */
	session?: {did: string; handle: string}
	shortcuts?: Record<string, string>
	show_track_artwork: boolean
	/** Default volume for new decks: 0 (silent) or 1 (full) */
	default_new_deck_volume: 0 | 1
	/** Whether new decks auto-play when a track is loaded */
	autoplay_new_deck: boolean
	/** Show playback speed control in deck transport */
	show_speed_control?: boolean
	/** Show track progress/range control in deck transport */
	show_track_range_control?: boolean
	/** Use pointer cursor on interactive elements instead of default arrow */
	use_pointer_cursor?: boolean
	/** Floating shell/deck panels (padding/gap). Off = flush with section seams. On by default. */
	floating_ui?: boolean
	/** Show borders on panels, cards, and controls. Off = borderless (still uses background for separation). On by default. */
	show_borders?: boolean
	font_family?: string
	language?: string
	modal_track_add?: {track?: Track; url?: string} | null
	modal_track_edit?: {track: Track} | null
	modal_share?: {track?: Track; channel: Channel} | null
	modal_shortcuts?: boolean
	show_welcome_hint?: boolean
	show_onboarding_hint?: boolean
}

export type KeyBindingsConfig = Record<string, string>

/**
 * Playback fields with the same name and shape on both Deck and BroadcastDeckState —
 * shared vocabulary for mapping state between a local deck and a broadcast.
 */
export interface BroadcastPlaybackFields {
	track_played_at?: string | null
	seeked_at?: string | null
	seek_position?: number | null
	volume?: number
	muted?: boolean
	is_playing?: boolean
	speed?: number
}

/** One deck of a live broadcast, as listeners see it */
export interface BroadcastDeckState {
	index?: number
	track_id: string | null
	track_played_at: string | null
	is_playing?: boolean
	seeked_at?: string | null
	seek_position?: number | null
	volume?: number
	muted?: boolean
	speed?: number
	track_url?: string | null
	track_title?: string | null
	track_media_id?: string | null
}

export interface Broadcast {
	/** DID of the broadcasting channel */
	channel_id: string
	decks: BroadcastDeckState[]
	updated_at?: string
	channels?: Channel
}

export interface CaptureEvent {
	id: string
	event: string
	properties?: Record<string, unknown>
	created_at: string
}

/**
 * Why a track started playing
 * - auto_next: Automatic advance after track completed
 * - broadcast_sync: Synced from broadcast
 * - play_channel: Started playing a channel (first track)
 * - play_search: Started from search results
 * - track_error: Previous track had error, auto-advancing
 * - user_click_track: User clicked on a specific track
 * - user_next: User clicked next button
 * - user_prev: User clicked previous button
 */
export type PlayStartReason =
	| 'auto_next'
	| 'broadcast_sync'
	| 'play_channel'
	| 'play_search'
	| 'track_error'
	| 'user_click_track'
	| 'user_next'
	| 'user_prev'

/**
 * Why a track stopped playing
 * - broadcast_sync: Stopped due to broadcast sync
 * - playlist_change: Playlist/queue changed while playing
 * - track_completed: Track played to the end naturally
 * - user_next: User clicked next button
 * - user_prev: User clicked previous button
 * - user_stop: User clicked stop/pause
 * - youtube_error: YouTube player error (stored as youtube_error_${code} with specific error codes)
 */
export type PlayEndReason =
	| 'broadcast_sync'
	| 'playlist_change'
	| 'track_completed'
	| 'user_next'
	| 'user_prev'
	| 'user_stop'
	| 'youtube_error'

export interface Ok<T> {
	ok: true
	value: T
}

export interface Err<E> {
	ok: false
	error: E
}

export function ok<T>(value: T): Ok<T> {
	return {
		ok: true,
		value
	}
}

export function err<T>(error: T): Err<T> {
	return {
		ok: false,
		error
	}
}
