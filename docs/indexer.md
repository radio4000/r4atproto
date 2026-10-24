# Indexer (draft for review)

Status: proposal, nothing built. For the launch on Bluesky, sized for 10,000 radios.

## Why

Today every visitor's browser reads the whole network itself. Per page load:

| What            | Where in the code                            | Requests per visitor | At 10,000 radios   |
| --------------- | -------------------------------------------- | -------------------- | ------------------ |
| List of radios  | `fetchRadioDids`, `fetchChannels`            | ~3 per radio         | ~30,000            |
| Live broadcasts | `loadBroadcasts` (every page, layout)        | 1 per radio          | ~10,000            |
| Network feed    | `fetchLatestTracks`                          | 1 per radio          | ~10,000            |
| Search          | `views.svelte.ts` (loads all radios' tracks) | every track listing  | millions of tracks |
| A radio's page  | its PDS, 100 tracks per request              | tracks ÷ 100         | unchanged          |

With one radio on the network this is ~10–35 requests a page. It grows with every radio, so it breaks long before 10,000. Reading the network in each browser is what an atproto **AppView** replaces: one service follows the network, keeps an index, and answers queries. Bluesky does this for posts; we do it for `radio.4000.*`.

## What stays the same

- Records live in each person's repo; the app writes to their PDS, as now. The indexer never writes, and holds nothing that isn't already public.
- It is a cache of the network: it can be deleted and rebuilt from the network at any time, and anyone can run their own from this repository.
- A radio's own page can still read its PDS directly, so the app keeps working if the indexer is down.
- Chat is indexed too, so the app no longer depends on Constellation or Slingshot. What stays outside: Jetstream, the PLC directory, and Bluesky's AppView for profiles and blocks, which is how any atproto app reads them.

## Pieces

All on Cloudflare, next to the app, in this repository (`indexer/`, its own `wrangler.toml`).

1. **Ingest: a Durable Object, one instance.** Holds one Jetstream connection filtered to `radio.4000.*`, plus identity and account events (handle changes, deactivated or taken-down accounts). It validates each record against our lexicons (the same `schemas.ts` as the app), writes to D1 in small batches, and stores Jetstream's cursor so a restart resumes where it stopped, without gaps.
2. **Backfill: a Queue.** Lists every repo holding `radio.4000.channel` or `radio.4000.track` (relay `listReposByCollection`), then reads each repo once with `listRecords`, a few repos at a time per PDS host. Runs at first start, and again for any repo the ingest finds out of sync.
3. **Database: D1** (SQLite). Full-text search with FTS5.
4. **API: a Worker** at `https://api.4000.radio` (`services.index` in `app.json`), answering XRPC queries with cache headers, so visitors share responses for 30–60 s and the database sees a fraction of the traffic.

## Tables

- `radios`: did, handle, pds, name, description, image cid, links, latitude, longitude, theme, r4 slug, created/updated, track count, latest track at.
- `tracks`: uri, did, rkey, url, title, description, discogs url, duration, provider, media id, created/updated.
- `track_tags`: uri, tag (from #tags in descriptions, as the app derives them).
- `tracks_fts`, `radios_fts`: full-text search over titles, descriptions, names.
- `follows`: uri, did, subject, created (for followers and following lists).
- `broadcasts`: did, decks, updated (live now; stale after `broadcast.staleSeconds`).
- `chat_messages`: uri, did, subject (the radio), text, track, created.
- `cursor`: Jetstream position.

10,000 radios × a few hundred tracks is a few million rows, about 1–3 GB. D1 allows 10 GB per database.

## Queries

Defined as lexicons in `lexicons/radio/4000/` (drafts, not published yet). Each view carries the record as it is in the repo, like Bluesky's views, so the app maps it with the code it already has.

- `radio.4000.defs`: the views (`radioView`, `trackView`, `broadcastView`, `chatMessageView`).
- `radio.4000.listRadios`: paged; `q` to search, `sort` by latest track, new or most tracks, `bbox` for a map area (home, explore, search).
- `radio.4000.getRadios`: up to 25 by DID (cards, follows, a radio's header).
- `radio.4000.listTracks`: newest first, from the network or given `radios`, filtered by `tags`, `mention`, `q` (the feed, following, search, a radio's page).
- `radio.4000.listBroadcasts`: who is live now.
- `radio.4000.chat.listMessages`: a room's messages, newest first.

`radio.4000.*` and `radio.4000.chat.*` are covered by the existing `_lexicon` DNS records. Home, explore, search and the feed each become one request, whatever the size of the network.

## Abuse and limits

- Records failing validation are skipped, as in the app.
- A cap on indexed tracks per radio (e.g. 20,000; the biggest radio4000.com radios are below that) and on writes per account per minute, so one account can't flood the index.
- Deactivated or taken-down accounts disappear from the index with the account event.
- Moderation labels can come later, from labelers, the atproto way.

## Cost

Workers paid plan ($5/month). At this size D1 storage, reads and writes, the Queue, and one always-connected Durable Object should fit in the plan's included usage; I'll measure during the load test before launch rather than promise numbers now.

## Steps

1. Query lexicons, reviewed by you before code.
2. Indexer: ingest, backfill, tables, API, with tests.
3. Load test: 10,000 synthetic radios in a local D1, measure response times.
4. App: home, explore, search, feed and broadcasts read from the indexer; radio pages from the indexer with the PDS as fallback.
5. Deploy `api.4000.radio`, backfill the real network, compare against direct reads.
6. Publish the query lexicons. Then promote.

## Decided

- API at `api.4000.radio`.
- Chat indexed, to depend on fewer outside services.

## Open

- Live updates: browsers keep one Jetstream connection each for chat and broadcasts. Fine at launch; if it becomes heavy, the Durable Object can relay them.
