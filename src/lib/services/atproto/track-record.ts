/**
 * Maps between radio.4000.track records (camelCase, as in the lexicon) and the
 * app's Track (snake_case, as in r4's domain model).
 */
import {TRACK} from '../../lexicons'
import type {Track} from '../../types/index'

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

export function trackFromRecord(r: {uri: string; cid?: string; value: unknown}): Track {
	const v = r.value as TrackRecord
	return {
		uri: r.uri,
		cid: r.cid,
		rkey: r.uri.split('/').pop(),
		url: v.url,
		title: v.title,
		description: v.description,
		discogs_url: v.discogsUrl,
		duration: v.duration,
		playback_error: v.playbackError,
		r4_id: v.r4Id,
		created_at: v.createdAt,
		updated_at: v.updatedAt
	}
}

export function trackToRecord(t: Partial<Track>): TrackRecord {
	return {
		$type: TRACK,
		url: t.url ?? '',
		title: t.title ?? '',
		description: t.description || undefined,
		discogsUrl: t.discogs_url || undefined,
		duration: t.duration ?? undefined,
		playbackError: t.playback_error || undefined,
		r4Id: t.r4_id || undefined,
		createdAt: t.created_at ?? new Date().toISOString(),
		updatedAt: t.updated_at || undefined
	}
}
