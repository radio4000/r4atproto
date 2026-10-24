# Radio4000 for AT Protocol

Radio4000 for AT Protocol is a SvelteKit 3 + Svelte 5 application that lets you save your favorite music links as custom AT Protocol records and play them inside a modern web player. The app focuses on personal collections (the shared timeline will return later) and ships as a static bundle that deploys to https://4000.radio on Cloudflare.

## Features

- **AT Protocol OAuth** – secure sign-in powered by `@atproto/oauth-client-browser`, no passwords required. The session layer automatically handles loopback vs HTTPS clients.
- **Track management** – create, browse, edit, and delete `radio.4000.track` records with metadata pulled from oEmbed providers and optional Discogs lookups.
- **Built-in player** – queue, shuffle, and control tracks from YouTube, Vimeo, SoundCloud, or direct file links via `src/lib/player/store.ts` and `src/lib/components/Player.svelte`.
- **Discogs helpers** – paste a Discogs release/master URL to fetch suggested hashtags or open a pre-filled Discogs search when you already know the artist/title.
- **Favorites and theming** – follow radios via `radio.4000.follow`, manage the palette stored on your `radio.4000.channel`, and load the theme automatically on login.
- **I18n + UI kit** – English and French translations live in `src/lib/i18n`, and interface components are built on a small shadcn-inspired kit under `src/lib/components/ui`.

## Tech stack

- [SvelteKit 3](https://svelte.dev/docs/kit) with Svelte 5 runes and Vite 8
- Static adapter with pre-rendered public routes (`bun run build` writes to `dist/`)
- TypeScript everywhere (`src` is ESM, `type: module` package)
- Tailwind & shadcn-svelte primitives for styling
- `@atproto/api` + `@atproto/oauth-client-browser` for Bluesky API access

## Getting started

Requires [bun](https://bun.sh).

```bash
bun install
bun run dev
# open http://127.0.0.1:5173
```

The dev server falls back to the loopback OAuth client, so local HTTP works without extra configuration. Over HTTPS the app serves its own `/client-metadata.json` (see below).

## Project scripts

| Command                    | Description                                                                                              |
| -------------------------- | -------------------------------------------------------------------------------------------------------- |
| `bun run dev`              | Start the Vite dev server.                                                                               |
| `bun run build`            | Build the static site to `dist/`.                                                                        |
| `bun run build:cloudflare` | Same build; the Cloudflare Git integration runs it to deploy https://4000.radio on every push to `main`. |
| `bun run preview`          | Serve the production build locally.                                                                      |
| `bun run test`             | Run the Vitest suite.                                                                                    |
| `bun run types`            | Type-check with svelte-check.                                                                            |
| `bun run check`            | Format (Prettier, Biome) and lint (ESLint).                                                              |

## OAuth & client metadata

`/client-metadata.json` is a prerendered route generated from `src/lib/config/app.json` and the lexicons, with granular scopes per collection. See [docs/lexicons.md](docs/lexicons.md).

## Routes & flows

| Route                 | Purpose                                                                                            |
| --------------------- | -------------------------------------------------------------------------------------------------- |
| `/`                   | Hub/sign-in and list of favorites once authenticated.                                              |
| `/explore`            | Network-wide feed: the latest tracks of every atproto user posting Radio4000 records (no backend). |
| `/add` and `/@me/add` | Track creation form with Discogs helpers.                                                          |
| `/@<handle>`          | View a radio, play tracks, and open Discogs data if attached.                                      |
| `/@<handle>/<rkey>`   | Track detail, including Discogs resource embeds.                                                   |
| `/search`             | Look up users/handles.                                                                             |
| `/settings`           | Review permissions, theme prefs, and session state.                                                |

## Project layout

- `src/lib/components` – shared UI (player, track cards, state cards, Discogs widgets, etc.).
- `src/lib/services` – AT Protocol helpers (`bsky-oauth`, `r4-service`, `oembed`, `discogs`, URL parsing).
- `src/lib/player` – lightweight player store with shuffle/next helpers.
- `src/lib/state` – session and theme stores hydrated from OAuth/profile records.
- `src/routes` – SvelteKit pages using runes (`/`, `/add`, `/search`, `/settings`, `/@handle`, nested track routes).

## Data model & services

Lexicons, records and scopes are described in [docs/lexicons.md](docs/lexicons.md).

`src/lib/services/r4-service.ts` handles DID resolution, DPoP retries, Discogs lookups, favorites, and theme persistence. The Discogs helper lives in `src/lib/services/discogs.ts` and is used by `TrackForm` and `DiscogsResource`.

## Testing

Run `bun run test` to execute the Vitest suite. The tests currently cover utility/services modules; feel free to add component tests under `src/lib/components` using the happy-dom environment defined in `vite.config.ts`.

## Troubleshooting

- **DPoP nonce errors** – retries are built in, but if you still see failures, reload after a few seconds; PDSs occasionally rotate nonces during local dev.
- **Missing scopes** – the app surfaces a "Missing permission" message when the AS rejected your authorization_details request. Open Settings, re-consent, or temporarily remove `authorization_details_types` from the metadata file.

## Additional documentation

- `README_ATPROTO.md` – quick overview tailored to AT Protocol builders.
- `AUTH_COMPARISON.md` – notes comparing OAuth client implementations.

## License

MIT
