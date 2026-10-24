/**
 * radio.4000.* records ⇄ domain objects. Records are camelCase as in the
 * lexicons; Track and Channel are snake_case like r4's domain model.
 */
import {parseUrl} from 'media-now'
import {BROADCAST, CHANNEL, TRACK} from '#lib/lexicons.js'
import {extractHashtags, extractMentions} from '#lib/utils.js'
import type {Broadcast, Channel, Track} from '#lib/types.js'
import type {Profile} from './profiles'
import type {RepoRecord} from './repo'
import {safeUrl} from './validate'
import app from '#lib/config/app.json' with {type: 'json'}

export interface TrackRecord {
	$type?: string
	url: string
	title: string
	description?: string
	discogsUrl?: string
	duration?: number
	playbackError?: string
	r4Id?: string
	createdAt: string
	updatedAt?: string
}

/** Colors of a radio, as HSL triplets like '262 83% 58%' */
export interface ChannelTheme {
	mode?: 'auto' | 'light' | 'dark'
	lightBackground?: string
	lightForeground?: string
	lightAccent?: string
	darkBackground?: string
	darkForeground?: string
	darkAccent?: string
}

export interface ChannelLink {
	url: string
	title?: string
}

export interface ChannelRecord {
	$type?: string
	name?: string
	description?: string
	image?: {ref: {$link: string} | string; mimeType?: string}
	links?: ChannelLink[]
	/** @deprecated single link, before `links` */
	url?: string
	geo?: {latitude: string; longitude: string}
	theme?: Channel['theme']
	r4Slug?: string
	createdAt: string
	updatedAt?: string
}

/** #tags of a description, without the #, as r4 stores them */
export function bareTags(description: string): string[] {
	return [...new Set(extractHashtags(description).map((tag) => tag.slice(1)))]
}

/** A track from its record, or null when its link isn't http(s) */
export function trackFromRecord(
	record: RepoRecord<TrackRecord>,
	owner: {did: string; handle: string}
): Track | null {
	const v = record.value
	const url = safeUrl(v.url)
	if (!url) return null
	const parsed = parseUrl(url)
	const description = v.description ?? null
	return {
		id: record.uri,
		did: owner.did,
		slug: owner.handle,
		url,
		title: v.title,
		description,
		discogs_url: safeUrl(v.discogsUrl),
		duration: v.duration ?? null,
		playback_error: v.playbackError ?? null,
		tags: description ? bareTags(description) : [],
		mentions: description ? extractMentions(description) : [],
		provider: parsed?.provider ?? null,
		media_id: parsed?.id ?? null,
		r4_id: v.r4Id ?? null,
		created_at: v.createdAt,
		updated_at: v.updatedAt ?? null
	}
}

export function trackToRecord(track: Partial<Track>): TrackRecord {
	return {
		$type: TRACK,
		url: track.url ?? '',
		title: track.title ?? '',
		description: track.description || undefined,
		discogsUrl: track.discogs_url || undefined,
		duration: track.duration ?? undefined,
		playbackError: track.playback_error || undefined,
		r4Id: track.r4_id || undefined,
		createdAt: track.created_at ?? new Date().toISOString(),
		updatedAt: track.updated_at || undefined
	}
}

function blobCid(image: ChannelRecord['image']): string | undefined {
	const ref = image?.ref
	return typeof ref === 'string' ? ref : ref?.$link
}

/** A channel from its record and/or Bluesky profile. Either may be missing. */
export function channelFrom(
	owner: {did: string; handle: string; pds: string},
	record?: ChannelRecord | null,
	profile?: Profile | null
): Channel {
	const cid = blobCid(record?.image)
	const image = cid
		? `${owner.pds}/xrpc/com.atproto.sync.getBlob?did=${encodeURIComponent(owner.did)}&cid=${cid}`
		: (profile?.avatar ?? null)
	const latitude = record?.geo ? Number.parseFloat(record.geo.latitude) : null
	const longitude = record?.geo ? Number.parseFloat(record.geo.longitude) : null
	return {
		id: owner.did,
		slug: owner.handle,
		name: record?.name || profile?.displayName || owner.handle,
		description: record?.description ?? profile?.description ?? null,
		image,
		links: (record?.links ?? (record?.url ? [{url: record.url}] : [])).filter((link) =>
			safeUrl(link.url)
		),
		latitude: Number.isFinite(latitude) ? latitude : null,
		longitude: Number.isFinite(longitude) ? longitude : null,
		theme: record?.theme,
		r4_slug: record?.r4Slug ?? null,
		has_record: Boolean(record),
		created_at: record?.createdAt ?? null,
		updated_at: record?.updatedAt ?? null
	}
}

export function channelToRecord(
	channel: Partial<Channel>,
	existing?: ChannelRecord | null
): ChannelRecord {
	const now = new Date().toISOString()
	const geo =
		channel.latitude != null && channel.longitude != null
			? {latitude: String(channel.latitude), longitude: String(channel.longitude)}
			: undefined
	return {
		...existing,
		$type: CHANNEL,
		name: channel.name ?? existing?.name,
		description: channel.description ?? existing?.description,
		links: channel.links ?? existing?.links ?? (existing?.url ? [{url: existing.url}] : undefined),
		url: undefined,
		geo: 'latitude' in channel ? geo : existing?.geo,
		theme: channel.theme ?? existing?.theme,
		r4Slug: channel.r4_slug ?? existing?.r4Slug,
		createdAt: existing?.createdAt ?? now,
		updatedAt: now
	}
}

export interface FollowRecord {
	$type?: string
	subject: string
	createdAt: string
}

/** rkey of a follow record, derived from the followed DID so each radio is followed once */
export function followRkey(subject: string): string {
	return subject.replace(/[^a-z0-9._-]/gi, '-').toLowerCase()
}

export interface BroadcastDeckRecord {
	track: string
	url: string
	title?: string
	positionMs: number
	positionAt: string
	playing: boolean
	speed?: number
}

export interface BroadcastRecord {
	$type?: string
	decks: BroadcastDeckRecord[]
	updatedAt: string
}

/** A broadcast record as r4's BroadcastDeckState list, which the deck sync code speaks */
export function broadcastFromRecord(did: string, record: BroadcastRecord): Broadcast {
	return {
		channel_id: did,
		updated_at: record.updatedAt,
		// A listener opens one deck per broadcast deck: keep that bounded
		decks: record.decks.slice(0, app.broadcast.maxDecks).map((d, index) => ({
			index,
			track_id: d.track,
			track_url: safeUrl(d.url) ?? '',
			track_title: d.title ?? null,
			track_media_id: null,
			track_played_at: null,
			seek_position: d.positionMs / 1000,
			seeked_at: d.positionAt,
			is_playing: d.playing,
			speed: (d.speed ?? 100) / 100
		}))
	}
}

export function broadcastToRecord(decks: BroadcastDeckRecord[]): BroadcastRecord {
	return {$type: BROADCAST, decks, updatedAt: new Date().toISOString()}
}
