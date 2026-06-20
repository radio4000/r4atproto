/**
 * AT Protocol Network Service
 *
 * A lightweight, backend-free "app view" for Radio4000.
 *
 * It builds a network-wide feed of every atproto repo that publishes
 * `com.radio4000.track` records, without running any indexing infrastructure:
 *
 *   1. Discover DIDs via the public relay
 *      (`com.atproto.sync.listReposByCollection`). The relay already indexes
 *      which repos host which collections, so this is a single cheap call.
 *   2. Fan out to each repo's PDS for its latest N tracks
 *      (`com.atproto.repo.listRecords`, with bounded concurrency).
 *   3. Resolve Bluesky profiles for display.
 *
 * We call the relay and PDSes with a plain `fetch` rather than the
 * `@atproto/api` Agent. The Agent attaches an `atproto-accept-labelers`
 * header, which makes the browser send a CORS preflight that the relay (and
 * some PDSes) reject. A bare GET with only safelisted headers is a "simple
 * request", so it passes their `Access-Control-Allow-Origin: *`.
 *
 * Scaling note: step 2 is one request per repo, so this fan-out model is
 * appropriate up to roughly a few hundred radios. It paginates the relay
 * cursor so the UI can lazy-load more radios on demand. Past that scale a
 * proper indexing AppView (Jetstream -> DB -> precomputed feed) is required —
 * see docs/services.md.
 */

import { getPdsForDid } from '../../utils/atproto-client'
import { getProfiles } from './social.service'
import { R4_COLLECTION } from './tracks.service'
import type { Track, AtProtoRecord } from '../../types'

/**
 * Public relay that indexes the firehose. Its `listReposByCollection`
 * endpoint enumerates every repo hosting a given collection.
 */
export const RELAY_SERVICE = 'https://relay1.us-west.bsky.network'

type XrpcParams = Record<string, string | number | boolean | undefined>

/**
 * Minimal XRPC GET over plain `fetch` (no Agent — see file header for why).
 * Only the safelisted `accept` header is sent, so no CORS preflight occurs.
 */
async function xrpcGet<T>(service: string, method: string, params: XrpcParams): Promise<T> {
  const url = new URL(`${service.replace(/\/$/, '')}/xrpc/${method}`)
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, String(value))
  }
  const res = await fetch(url, { headers: { accept: 'application/json' } })
  if (!res.ok) {
    throw new Error(`${method} failed (${res.status})`)
  }
  return (await res.json()) as T
}

export interface RadioActor {
  did: string
  handle?: string
  displayName?: string
  avatar?: string
  description?: string
}

/** A single radio (atproto user) and their latest tracks. */
export interface NetworkRadio {
  did: string
  profile: RadioActor | null
  tracks: Track[]
}

export interface NetworkFeedOptions {
  /** How many of each radio's latest tracks to fetch (default 10). */
  tracksPerUser?: number
  /** How many radios to discover per page (default 50). */
  maxUsers?: number
  /** Max concurrent PDS requests during fan-out (default 5). */
  concurrency?: number
  /** Relay cursor for loading the next page of radios. */
  cursor?: string
}

export interface NetworkFeedResult {
  radios: NetworkRadio[]
  /** Relay cursor; pass back to load the next page, undefined when exhausted. */
  cursor?: string
}

/**
 * One page of DIDs that host the given collection.
 *
 * Served by the public relay — no backend or authentication required.
 */
export async function listReposByCollection(
  collection: string = R4_COLLECTION,
  { cursor, limit = 100 }: { cursor?: string; limit?: number } = {}
): Promise<{ dids: string[]; cursor?: string }> {
  const data = await xrpcGet<{ repos?: { did: string }[]; cursor?: string }>(
    RELAY_SERVICE,
    'com.atproto.sync.listReposByCollection',
    { collection, limit, cursor }
  )
  return {
    dids: (data.repos || []).map((r) => r.did),
    cursor: data.cursor,
  }
}

/**
 * Discover up to `max` DIDs that host the collection, paginating the relay.
 */
export async function listAllReposByCollection(
  collection: string = R4_COLLECTION,
  { max = 500 }: { max?: number } = {}
): Promise<string[]> {
  const dids: string[] = []
  let cursor: string | undefined
  do {
    const page = await listReposByCollection(collection, { cursor, limit: 200 })
    dids.push(...page.dids)
    cursor = page.cursor
  } while (cursor && dids.length < max)
  return dids.slice(0, max)
}

/**
 * Fetch a single repo's latest tracks directly from its PDS.
 *
 * Goes straight to the PDS (the public AppView does not proxy custom-collection
 * `listRecords`), so this is one resolve + one list call per repo.
 */
async function fetchLatestTracksForDid(did: string, limit: number): Promise<Track[]> {
  const pds = await getPdsForDid(did)
  const data = await xrpcGet<{ records?: AtProtoRecord[] }>(
    pds,
    'com.atproto.repo.listRecords',
    {
      repo: did,
      collection: R4_COLLECTION,
      limit,
      // listRecords orders by rkey; its default (reverse=false) is rkey-descending,
      // i.e. newest records first — exactly the "latest N" we want. (reverse=true
      // would return the oldest records.)
      reverse: false,
    }
  )
  return (data.records || []).map((r: AtProtoRecord) => ({
    uri: r.uri,
    cid: r.cid,
    rkey: r.uri?.split('/').pop(),
    authorDid: did,
    ...r.value,
  })) as Track[]
}

/** Run async tasks with bounded concurrency, preserving input order. */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0
  const workerCount = Math.max(1, Math.min(limit, items.length))
  const workers = Array.from({ length: workerCount }, async () => {
    while (true) {
      const i = next++
      if (i >= items.length) break
      results[i] = await fn(items[i], i)
    }
  })
  await Promise.all(workers)
  return results
}

/**
 * Build the network-wide feed: the latest tracks of every atproto user that
 * publishes `com.radio4000.track` records.
 *
 * Radios with no readable tracks (deleted records, unreachable PDS) are
 * dropped from the result.
 */
export async function getNetworkLatestTracks({
  tracksPerUser = 10,
  maxUsers = 50,
  concurrency = 5,
  cursor,
}: NetworkFeedOptions = {}): Promise<NetworkFeedResult> {
  const page = await listReposByCollection(R4_COLLECTION, { cursor, limit: maxUsers })
  const dids = page.dids

  if (dids.length === 0) {
    return { radios: [], cursor: undefined }
  }

  // Fetch profiles and tracks in parallel; neither blocks the other.
  const profilesPromise = getProfiles(dids)
  const trackLists = await mapWithConcurrency(dids, concurrency, async (did) => {
    try {
      return await fetchLatestTracksForDid(did, tracksPerUser)
    } catch (err) {
      console.warn('[network] failed to load tracks for', did, err)
      return [] as Track[]
    }
  })
  const profiles = await profilesPromise

  const radios: NetworkRadio[] = dids
    .map((did, i) => {
      const profile = (profiles.get(did) as RadioActor | undefined) ?? null
      const handle = profile?.handle
      // Stamp the resolved handle so the player and track cards can link back.
      const tracks = trackLists[i].map((t) => ({ ...t, authorHandle: handle }))
      return { did, profile, tracks }
    })
    .filter((radio) => radio.tracks.length > 0)

  return { radios, cursor: page.cursor }
}
