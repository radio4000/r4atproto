# Contributing

## Local development

```sh
# Install dependencies
bun install

# Start dev server
bun dev

# Run tests
bun test
```

The app runs at `http://localhost:5173` by default.

---

## Stack

- **Framework:** SvelteKit 2 + Svelte 5 (runes syntax)
- **Styling:** Tailwind CSS + shadcn-svelte component library
- **Protocol:** AT Protocol via `@atproto/api`
- **Auth:** AT Protocol OAuth (`@atproto/oauth-client-browser`)
- **Local state:** TanStack Svelte DB (IndexedDB)
- **Build:** Vite, static adapter (`@sveltejs/adapter-static`)

---

## Project structure

```
src/
  lib/
    components/       # Svelte components
    config/           # Instance-level configuration
    i18n/             # Translations (en, fr)
    services/         # Data layer (AT Protocol, Discogs, oEmbed)
    state/            # Svelte stores (session, theme)
    stores/           # TanStack DB collections
    utils.ts          # Shared helpers
  routes/             # SvelteKit file-based routing
docs/                 # This documentation
```

---

## Adding a new page

1. Create `src/routes/your-page/+page.svelte`
2. Add any server-side data loading in `+page.ts` if needed
3. Add a nav link in `src/lib/components/NavBar.svelte`
4. Add translation keys to both `src/lib/i18n/locales/en.ts` and `fr.ts`

---

## Adding a new AT Protocol collection

1. Define the Lexicon in the relevant service file under `src/lib/services/atproto/`
2. Export from `src/lib/services/atproto/index.ts`
3. Re-export from `src/lib/services/r4-service.ts`
4. Add the collection to the permissions list in `src/routes/settings/permissions/+page.svelte`
5. Document it in [services.md](./services.md)

---

## Customising featured profiles

Edit `src/lib/config/featured-profiles.ts`. See [configuration.md](./configuration.md) for details.

---

## i18n

All user-visible strings must use the `translate()` helper:

```ts
import { locale, translate } from '$lib/i18n'
const t = (key, vars = {}) => translate($locale, key, vars)

// Usage
t('search.placeholder')
t('search.emptyDescription', { query: q })
```

Add keys to both `src/lib/i18n/locales/en.ts` and `fr.ts` when adding new UI.
