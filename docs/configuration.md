# Configuration

Instance-level config lives in `src/lib/config/`.

---

## Featured profiles

**File:** `src/lib/config/featured-profiles.ts`

A static list of AT Protocol handles (or DIDs) shown on the `/search` page before the user types a query. Edit this list to curate the featured profiles for your deployment.

```ts
export const FEATURED_PROFILES: string[] = [
  'lucho1112.bsky.social',
  '0sk.ar',
  'radio4000.com',
  'hwww.org',
]
```

- Accepts handles (`alice.bsky.social`) or DIDs (`did:plc:…`)
- Fetched in a single `getProfiles()` batch call on component mount
- Maximum 25 entries (AT Protocol API limit per batch)
- Order in the array is the display order

---

## Theme defaults

Default light and dark color palettes are defined in the theme store:

**File:** `src/lib/state/theme.ts` — `DEFAULT_LIGHT_COLORS`, `DEFAULT_DARK_COLORS`

These are HSL values used when a user has not customised their appearance or clicks "Reset to Defaults" in `/settings/appearance`.

---

## Internationalization

**File:** `src/lib/i18n/locales/`

Add a new locale by:
1. Copying `en.ts` to `[lang].ts` and translating all strings
2. Adding the locale code to the available locales list in `src/lib/i18n/index.ts`
3. The language will appear in `/settings/language` automatically
