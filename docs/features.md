# Features

## Pages

### `/` — Home

- **Authenticated:** Shows the signed-in user's profile header, then a list of Radio4000 profiles they have favorited. Each favorite is a clickable `ProfileHeader` card linking to that user's profile page. Empty state prompts exploration.
- **Unauthenticated:** Hero section + sign-in form.

---

### `/add` — Add a track

Form to publish a new music track to the AT Protocol network.

**Fields:**
| Field | Required | Notes |
|---|---|---|
| URL | yes | YouTube, Vimeo, SoundCloud, direct audio files |
| Title | yes | Auto-filled from oEmbed if left empty |
| Description | no | Free-text notes |
| Discogs URL | no | Links to a Discogs release or master for metadata |

On success the user is redirected to the new track's detail page.

---

### `/search` — Search profiles

Search for AT Protocol users by handle. Before the user types anything, a curated list of **featured profiles** is shown (see [Configuration](./configuration.md)).

- Type a query → live search via `searchActors()`
- Clear query → featured profiles reappear
- Each result links to that user's profile page

---

### `/[handle]` — Profile

Browse all tracks published by a user.

- Tracks grouped by Year-Month
- Infinite scroll: "Load More" / "Load All" buttons
- Refresh button to check for new tracks
- Track owner sees edit and delete controls on each item
- Click a track to open a detail dialog

---

### `/[handle]/favorites` — Favorites

List of Radio4000 profiles that `[handle]` has favorited (follows). Paginated.

---

### `/[handle]/tracks/[rkey]` — Track detail

Full detail view for a single track.

- Player controls (play/pause)
- Title, URL, description, Discogs link, created/updated dates
- Navigation to previous/next track in the library
- Discogs release metadata if a Discogs URL is set
- Edit button (owner only)

---

### `/[handle]/tracks/[rkey]/edit` — Edit track

Same fields as `/add`, pre-filled with the existing track data.

---

### `/[handle]/edits/durations` — Duration auto-fetch

Batch tool that finds tracks missing a `duration_seconds` value and fetches it automatically.

**Supported sources:**
- YouTube (iframe API)
- Vimeo (Player API)
- Direct audio files (HTML5 `Audio`)

Processes each track in turn, shows per-track success/error, and saves results back to the AT Protocol record. Only accessible to the profile owner.

---

## Settings

### `/settings/account`

- View handle and DID
- View current app permissions per AT Protocol collection
- **Export tracks** — downloads the full track library as a JSON backup file
- **Delete all tracks** — bulk-deletes with confirmation dialog and progress display
- Sign out

### `/settings/appearance`

Customise the app's visual theme:

- Mode: Auto / Light / Dark
- Background, foreground, and accent colors with a color picker
- Changes are saved to the `com.radio4000.profile` AT Protocol record and are visible to other users on the profile page

### `/settings/permissions`

View which AT Protocol collections the app has write access to and trigger a re-consent flow if permissions are missing.

### `/settings/language`

Select display language. Currently: English (`en`) and French (`fr`). Stored in `localStorage`.

### `/settings/sync` — Import from Radio4000

Import tracks from the legacy Radio4000 platform (Supabase backend).

1. Enter your Radio4000 channel slug (and optionally a custom API endpoint / key)
2. "Load Channel" fetches track count and channel metadata
3. "Import Missing Tracks" creates AT Protocol records for any tracks not yet imported (skips duplicates)
4. Config is persisted as a `com.radio4000.sync` record on AT Protocol
