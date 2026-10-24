# Data and state

## Remote

Each radio's PDS is the source of truth; there is no server of ours. `src/lib/atproto/` reads repos with plain fetch (`repo.ts`), resolves handles, DIDs (plc and web) and PDSes (`identity.ts`), reads Bluesky profiles from the public AppView (`profiles.ts`), and writes to the signed-in account's repo (`write.ts`). `records.ts` maps `radio.4000.*` records to the domain types in `src/lib/types.ts`. Service URLs live in `src/lib/config/app.json`.

## Reads and rate limits

PDSes rate-limit by IP, and a page showing many radios reads from many repos. So single records (channel, broadcast, chat messages) come from Slingshot, microcosm's public record cache, with the PDS as fallback; only track listings go to PDSes, and cards and feeds share one listing per radio (`feed.perRadio`). Identical reads share one request and are reused for `reads.cacheSeconds`. Every read goes through one pool (`atproto/pool.ts`): at most `reads.perHost` requests in flight per host, and a host answering 429 is paused for as long as it asks, then retried up to `reads.retries` times. Home costs each radio's PDS one request.

## Collections

Same TanStack DB setup and API as r4-svelte (see [tanstack.md](tanstack.md) for the contracts), so components port over:

```
PDS → Query cache (memory) → Collection (memory) → useLiveQuery → Component
```

- `tracksCollection`, keyed by at:// URI, on demand by `slug` (handle), `did` or `id`. A PDS can't filter, so a channel's tracks load whole and live queries filter locally.
- `channelsCollection`, keyed by DID: the `radio.4000.channel` record, the Bluesky profile as fallback. Without an id/slug filter it browses every repo the relay lists as holding tracks.
- `followsCollection`: DIDs the signed-in account follows.
- `broadcastsCollection`: radios broadcasting now. Read once from every radio's `radio.4000.broadcast` record, then kept current from Jetstream (`atproto/jetstream.ts`); a record without a heartbeat for `broadcast.staleSeconds` counts as over.

## Chat

`src/lib/chat.ts`. Each radio has a public room at `/@handle/chat`. Messages are records in their senders' repos; the room's history comes from Constellation (microcosm's public backlinks index, `services.constellation`), new messages from Jetstream. A message can point at a track (its at:// URI in `track`): the composer offers the track on the active deck, and the room shows it with a play button.

Rooms respect Bluesky blocks (`chat-blocks.ts`): Bluesky's AppView, which knows every block of the network, is asked who blocks whom (`app.bsky.graph.getRelationships`, one request per 30 authors). Authors blocked by or blocking the radio's owner are out of its room, and can't post there; the same goes between you and the authors you read. Muting an account (`chat-moderation.svelte.ts`) is private and stays in the browser. Unread counts skip both.

## Broadcast

`src/lib/broadcast.ts`. Going live writes the broadcast record on every track change, pause, seek or speed change (debounced) and as a heartbeat; stopping, or idling past `broadcast.idleStopSeconds`, deletes it. Joining replaces your decks with one listener deck per broadcast deck, seeked to the broadcaster's position and re-synced when drifted (r4's logic and `broadcast-utils.js`). Timings live in `config/app.json`.

Writes go to the PDS in the mutation handlers and are written back with `writeUpsert`. Track ids are minted client-side (a TID rkey), so an optimistic insert keeps its id.

## App state

`appState` (`app-state.svelte.ts`) is r4-svelte's reactive global persisted to localStorage: decks, queues, preferences. The session and the account's channel are runtime only.
