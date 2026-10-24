# Contributing

## Conventions

- **Classless:** semantic HTML and `r4-*` custom elements, state as attributes (`aria-current`, `aria-pressed`, `expanded="true"`; `data-*` on native elements). No classes, no hardcoded values: every value is a token in `src/styles/variables.css`.
- **No hardcoded strings:** copy lives in `i18n/messages/*.json` (`m.key()`); add new keys with `node i18n/add.js batch.json`.
- **Identifiers and settings in one place:** namespace, domain and service URLs in `src/lib/config/app.json`, UI constants in `ui.json`.
- **Data models:** lexicons in `lexicons/`; records are mapped to domain types in `src/lib/atproto/records.ts`.
- **Same as r4-svelte where possible:** components, collections and the deck API keep r4-svelte's names, so changes can flow between the two.

## Layout

```
src/lib/atproto      identity, repo reads, writes, OAuth
src/lib/collections  TanStack DB collections (tracks, channels, follows, feed)
src/lib/components   r4-* components
src/lib/player       deck helpers: queue, auto-radio, media session
src/lib/api.ts       deck orchestration (play, queue, layout)
src/routes           pages; a radio is /@handle
src/styles           global classless styles
```

Make atomic commits; run `bun run check`, `bun run types` and `bun run test` before pushing.
