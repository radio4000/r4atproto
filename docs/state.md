# Data and state

## Remote

Each radio's PDS is the source of truth; there is no server of ours. `src/lib/atproto/` reads repos with plain fetch (`repo.ts`), resolves handles, DIDs (plc and web) and PDSes (`identity.ts`), reads Bluesky profiles from the public AppView (`profiles.ts`), and writes to the signed-in account's repo (`write.ts`). `records.ts` maps `radio.4000.*` records to the domain types in `src/lib/types.ts`. Service URLs live in `src/lib/config/app.json`.

## Collections

Same TanStack DB setup and API as r4-svelte (see [tanstack.md](tanstack.md) for the contracts), so components port over:

```
PDS → Query cache (memory) → Collection (memory) → useLiveQuery → Component
```

- `tracksCollection`, keyed by at:// URI, on demand by `slug` (handle), `did` or `id`. A PDS can't filter, so a channel's tracks load whole and live queries filter locally.
- `channelsCollection`, keyed by DID: the `radio.4000.channel` record, the Bluesky profile as fallback. Without an id/slug filter it browses every repo the relay lists as holding tracks.
- `followsCollection`: DIDs the signed-in account follows.
- `broadcastsCollection`: radios broadcasting now. Read once from every radio's `radio.4000.broadcast` record, then kept current from Jetstream (`atproto/jetstream.ts`); a record without a heartbeat for `broadcast.staleSeconds` counts as over.

## Broadcast

`src/lib/broadcast.ts`. Going live writes the broadcast record on every track change, pause, seek or speed change (debounced) and as a heartbeat; stopping, or idling past `broadcast.idleStopSeconds`, deletes it. Joining replaces your decks with one listener deck per broadcast deck, seeked to the broadcaster's position and re-synced when drifted (r4's logic and `broadcast-utils.js`). Timings live in `config/app.json`.

Writes go to the PDS in the mutation handlers and are written back with `writeUpsert`. Track ids are minted client-side (a TID rkey), so an optimistic insert keeps its id.

## App state

`appState` (`app-state.svelte.ts`) is r4-svelte's reactive global persisted to localStorage: decks, queues, preferences. The session and the account's channel are runtime only.
