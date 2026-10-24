# Radio4000 on the AT Protocol

https://4000.radio — curate lists of media links, play them, explore other people's radios.

Your radio is an atproto account: its tracks are `radio.4000.track` records in your own repository, readable by any app. There is no server of ours; the app reads every radio straight from its PDS and writes to yours over OAuth.

- **Curate:** add tracks from any media URL (YouTube, SoundCloud, files…) with a title, notes, #tags and @mentions. Import a radio4000.com channel.
- **Play:** r4's multi-deck player: queues, shuffle, auto-radio (everyone hears the same track at the same second), keyboard shortcuts, lock-screen controls.
- **Showcase:** each radio at `/@handle`, filterable by #tag, @mention or text; one page per track.
- **Explore:** the latest tracks of every radio, radios to follow, tags, search across the network.

Built with SvelteKit 3 and Svelte 5, TanStack DB, Paraglide (21 languages), classless CSS. A port of [r4-svelte](https://github.com/radio4000/r4-svelte) onto atproto.

## Develop

Requires [bun](https://bun.sh).

```bash
bun install
bun run dev        # http://127.0.0.1:5173 (OAuth loopback clients need 127.0.0.1)
bun run test
bun run types
bun run check      # Prettier, Biome, ESLint
```

`bun run build` writes a static site to `dist/`. The Cloudflare Git integration builds and deploys https://4000.radio on every push to `main`.

In dev, `window.r4` exposes `appState`, `api`, `tracksCollection` and `channelsCollection` for the console.

## Docs

See [docs/](docs/README.md): lexicons, data and state, TanStack contracts, localization, tone.
