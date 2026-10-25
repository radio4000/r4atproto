/**
 * The index's views (radio.4000.defs) as the app's domain objects. Views carry the
 * records as in their repos; they are checked against our lexicons like any record
 * read from the network, and mapped with the same code.
 */
import {BROADCAST, CHANNEL, CHAT_MESSAGE, TRACK} from '#lib/lexicons.js'
import type {Broadcast, Channel, Track} from '#lib/types.js'
import type {Profile} from './profiles'
import {isValidRecord} from './schemas'
import {
	broadcastFromRecord,
	channelFrom,
	trackFromRecord,
	type BroadcastRecord,
	type ChannelRecord,
	type TrackRecord
} from './records'
import {safeUrl} from './validate'

export interface Author {
	did: string
	handle: string
}

export interface RadioView extends Author {
	record?: unknown
	image?: string
	trackCount: number
	latestTrackAt?: string
	indexedAt: string
}

export interface RecordView {
	uri: string
	cid: string
	author: Author
	record: unknown
	indexedAt: string
}

export interface BroadcastView {
	author: Author
	record: unknown
	indexedAt: string
}

export function channelFromView(view: RadioView, profile?: Profile | null): Channel {
	const record = isValidRecord<ChannelRecord>(CHANNEL, view.record) ? view.record : null
	// The view gives the image's URL, so no PDS is needed here
	const channel = channelFrom({did: view.did, handle: view.handle, pds: ''}, record, profile)
	channel.image = safeUrl(view.image) ?? profile?.avatar ?? null
	channel.track_count = view.trackCount
	channel.latest_track_at = view.latestTrackAt ?? null
	return channel
}

export function trackFromView(view: RecordView): Track | null {
	if (!isValidRecord<TrackRecord>(TRACK, view.record)) return null
	return trackFromRecord({uri: view.uri, cid: view.cid, value: view.record}, view.author)
}

export function broadcastFromView(view: BroadcastView): Broadcast | null {
	if (!isValidRecord<BroadcastRecord>(BROADCAST, view.record)) return null
	return broadcastFromRecord(view.author.did, view.record)
}

export function isChatMessage(view: RecordView): boolean {
	return isValidRecord(CHAT_MESSAGE, view.record)
}
