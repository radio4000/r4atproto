import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('../../utils/atproto-client', () => ({
  getPdsForDid: vi.fn(async (did: string) => `https://pds.example/${did}`),
  // present so tracks.service's imports resolve at module load
  assertAgent: vi.fn(),
  withDpopRetry: vi.fn(),
  fetchWithAgentFallback: vi.fn(),
}))

vi.mock('./social.service', () => ({
  getProfiles: vi.fn(async (dids: string[]) => {
    const map = new Map<string, unknown>()
    for (const did of dids) map.set(did, { did, handle: `${did}.test` })
    return map
  }),
}))

import { getNetworkLatestTracks, listReposByCollection } from './network.service'

function record(did: string, rkey: string, title: string) {
  return {
    uri: `at://${did}/com.radio4000.track/${rkey}`,
    cid: `cid-${rkey}`,
    value: { $type: 'com.radio4000.track', url: `https://example/${rkey}`, title },
  }
}

function json(data: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => data } as Response
}

// Maps each XRPC method to the data it should return; tests configure these.
let repos: { dids: { did: string }[]; cursor?: string }
let recordsByDid: Record<string, unknown[] | 'error'>

const fetchMock = vi.fn(async (input: URL | string) => {
  const url = new URL(String(input))
  if (url.pathname.endsWith('com.atproto.sync.listReposByCollection')) {
    return json({ repos: repos.dids, cursor: repos.cursor })
  }
  if (url.pathname.endsWith('com.atproto.repo.listRecords')) {
    const repo = url.searchParams.get('repo') || ''
    const recs = recordsByDid[repo]
    if (recs === 'error') return json({ error: 'boom' }, false, 500)
    return json({ records: recs ?? [] })
  }
  throw new Error(`unexpected fetch: ${url}`)
})

describe('network.service', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockClear()
    repos = { dids: [], cursor: undefined }
    recordsByDid = {}
  })

  it('lists repos and cursor from the relay', async () => {
    repos = { dids: [{ did: 'did:a' }, { did: 'did:b' }], cursor: 'next' }

    const res = await listReposByCollection()
    expect(res.dids).toEqual(['did:a', 'did:b'])
    expect(res.cursor).toBe('next')
    // hit the relay host
    expect(String(fetchMock.mock.calls[0][0])).toContain('relay1.us-west.bsky.network')
  })

  it('builds a feed of each radio with its latest tracks', async () => {
    repos = { dids: [{ did: 'did:a' }, { did: 'did:b' }, { did: 'did:c' }], cursor: 'next' }
    recordsByDid = {
      'did:a': [record('did:a', '2', 't2'), record('did:a', '1', 't1')],
      'did:b': [], // nothing readable
      'did:c': [record('did:c', '9', 't9')],
    }

    const { radios, cursor } = await getNetworkLatestTracks({ tracksPerUser: 10 })

    // did:b is dropped because it has no tracks
    expect(radios.map((r) => r.did)).toEqual(['did:a', 'did:c'])
    expect(cursor).toBe('next')

    const a = radios[0]
    expect(a.tracks).toHaveLength(2)
    expect(a.profile?.handle).toBe('did:a.test')
    // tracks are stamped with author identity for the player / cards
    expect(a.tracks[0].authorDid).toBe('did:a')
    expect(a.tracks[0].authorHandle).toBe('did:a.test')

    // requested newest-first (rkey-descending) with the configured limit
    const recordCall = fetchMock.mock.calls
      .map((c) => new URL(String(c[0])))
      .find((u) => u.pathname.endsWith('com.atproto.repo.listRecords') && u.searchParams.get('repo') === 'did:a')!
    expect(recordCall.searchParams.get('reverse')).toBe('false')
    expect(recordCall.searchParams.get('limit')).toBe('10')
  })

  it('returns an empty feed when no repos host the collection', async () => {
    repos = { dids: [], cursor: undefined }

    const { radios, cursor } = await getNetworkLatestTracks()
    expect(radios).toEqual([])
    expect(cursor).toBeUndefined()
    // no per-repo record fetches when there are no repos
    expect(fetchMock.mock.calls.some((c) => String(c[0]).includes('listRecords'))).toBe(false)
  })

  it('skips repos whose PDS fetch fails without failing the whole feed', async () => {
    repos = { dids: [{ did: 'did:ok' }, { did: 'did:bad' }], cursor: undefined }
    recordsByDid = {
      'did:ok': [record('did:ok', '1', 't1')],
      'did:bad': 'error',
    }

    const { radios } = await getNetworkLatestTracks()
    expect(radios.map((r) => r.did)).toEqual(['did:ok'])
  })
})
