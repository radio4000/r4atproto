// Helpers for at:// URIs and related route links

import {AtUri} from '@atproto/api'
import {TRACK} from '../lexicons'

interface ParsedUri {
	repo: string
	collection: string
	rkey: string
}

export function parseAtUri(uri: string): ParsedUri | null {
	try {
		const at = new AtUri(uri)
		return {repo: at.hostname, collection: at.collection!, rkey: at.rkey!}
	} catch (_) {
		return null
	}
}

export function buildTrackUri(
	repo: string,
	rkey: string,
	collection: string = TRACK
): string | null {
	if (!repo || !rkey) return null
	return `at://${repo}/${collection}/${rkey}`
}

export function buildEditHash(sessionHandle: string | undefined, uri: string): string | null {
	const parsed = parseAtUri(uri)
	if (!parsed) return null
	const {repo, rkey} = parsed
	if (sessionHandle)
		return `/@${encodeURIComponent(sessionHandle)}/tracks/${encodeURIComponent(rkey)}/edit`
	return `/${encodeURIComponent(repo)}/tracks/${encodeURIComponent(rkey)}/edit`
}

export function buildViewHash(sessionHandle: string | undefined, uri: string): string | null {
	const parsed = parseAtUri(uri)
	if (!parsed) return null
	const {repo, rkey} = parsed
	if (sessionHandle)
		return `/@${encodeURIComponent(sessionHandle)}/tracks/${encodeURIComponent(rkey)}`
	return `/${encodeURIComponent(repo)}/tracks/${encodeURIComponent(rkey)}`
}
