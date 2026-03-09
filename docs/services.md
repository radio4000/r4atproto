# Services

All services are re-exported from `src/lib/services/r4-service.ts`, which is the standard import path used across the app.

```ts
import { createTrack, getProfiles, searchActors, … } from '$lib/services/r4-service'
```

---

## AT Protocol collections

The app writes to four custom Lexicon collections under the `com.radio4000.*` namespace.

| Collection | Purpose | Key operations |
|---|---|---|
| `com.radio4000.track` | Music track records | create, list, get, update, delete |
| `com.radio4000.favorite` | Followed Radio4000 profiles | create, list, delete, check existence |
| `com.radio4000.profile` | User preferences (theme, colors) | get, set |
| `com.radio4000.sync` | Legacy import config | get, set |

---

## Track service — `atproto/tracks.service.ts`

| Function | Description |
|---|---|
| `createTrack(data)` | Publish a new track |
| `listTracksByDid(did, cursor?)` | Paginated track list |
| `listAllTracksByDid(did)` | Fetch every track across all pages |
| `getTrackByUri(uri)` | Single track by AT URI |
| `updateTrackByUri(uri, data)` | Overwrite track fields |
| `deleteTrackByUri(uri)` | Delete a single track |
| `deleteAllTracks(did)` | Batch-delete the full library |

---

## Favorites service — `atproto/favorites.service.ts`

| Function | Description |
|---|---|
| `listR4FavoritesByDid(did, cursor?)` | Paginated favorites list |
| `createR4Favorite(subject)` | Add a profile to favorites |
| `deleteR4Favorite(uri)` | Remove from favorites |
| `findR4FavoriteUri(did, subject)` | Get the URI of an existing favorite record |
| `hasR4FavoriteRecord(did, subject)` | Boolean check |

---

## Social service — `atproto/social.service.ts`

Wraps standard AT Protocol social graph calls.

| Function | Description |
|---|---|
| `searchActors(query, opts?)` | Search for users by handle/name |
| `getProfile(actor)` | Fetch a single profile by handle or DID |
| `getProfiles(actors[])` | Batch-fetch up to 25 profiles, returns `Map<did, profile>` |
| `followActor(did)` | Follow a user |
| `unfollowActor(uri)` | Unfollow using the follow record URI |
| `findFollowUri(did, subject)` | Get follow record URI |
| `getHandleByDid(did)` | Resolve DID → handle |

---

## Profile service — `atproto/profile.service.ts`

Stores per-user customisation as a singleton record in `com.radio4000.profile`.

| Function | Description |
|---|---|
| `getR4Profile(did)` | Read the user's stored profile preferences |
| `setR4Profile(data)` | Write/update preferences (theme mode, color palettes) |

---

## Sync service — `radio4000/sync.service.ts`

Import from the legacy Radio4000 platform.

| Function | Description |
|---|---|
| `getR4SyncConfig(did)` | Read stored sync config |
| `setR4SyncConfig(data)` | Persist sync config |
| `fetchRadio4000Channel(slug, opts?)` | Get channel metadata from legacy API |
| `fetchRadio4000Tracks(slug, opts?)` | Fetch all tracks from legacy channel |
| `importRadio4000Tracks(tracks, opts?)` | Create AT Protocol records for missing tracks |

---

## Discogs service — `discogs.service.ts`

Enriches track metadata with album/release info from Discogs.

| Function | Description |
|---|---|
| `parseDiscogsUrl(url)` | Extract type (`release`/`master`) and numeric ID |
| `fetchDiscogs(type, id)` | Fetch release or master data |
| `extractSuggestions(data)` | Pull genre/style tags as hashtag suggestions |

---

## oEmbed service — `oembed.ts`

Used when creating a track to auto-fill the title from the media URL.

| Function | Description |
|---|---|
| `getOEmbedUrl(mediaUrl)` | Build the oEmbed endpoint URL |
| `fetchOEmbed(mediaUrl)` | Fetch title and metadata for a YouTube/Vimeo/SoundCloud URL |

---

## Local tracks database — `stores/tracks-db.ts`

A client-side TanStack DB (IndexedDB) that caches the current user's tracks for reactive, instant UI updates.

| Function | Description |
|---|---|
| `loadTracksForDid(did)` | Load first page of tracks into local DB |
| `loadMoreTracksForDid(did)` | Load the next page |
| `getPaginationState(did)` | Check cursor and whether more pages exist |
| `removeTrack(uri)` | Delete from local DB |
| `updateTrack(uri, data)` | Update a track in local DB |
