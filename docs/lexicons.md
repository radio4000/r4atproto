# Lexicons

The namespace is set once in `src/lib/config/app.json` (`radio.4000`, the reverse of the 4000.radio domain). `src/lib/lexicons.ts` derives every NSID from it; code never spells an NSID out. The schemas live in `lexicons/radio/4000/`, and a test checks they match the configured namespace.

| NSID                   | rkey             | What                                                                                        |
| ---------------------- | ---------------- | ------------------------------------------------------------------------------------------- |
| `radio.4000.track`     | TID              | A media URL with title, description (#tags, @mentions), Discogs URL, duration               |
| `radio.4000.channel`   | `self`           | The account's radio: name, description, image, links, public coarse location (`geo`), theme |
| `radio.4000.follow`    | from subject DID | Following another radio; one record per followed DID                                        |
| `radio.4000.broadcast` | `self`           | What a radio plays live, per deck. Deleted when the broadcast ends                          |

Records use camelCase as in the lexicons. The app's `Track` type is snake_case like r4's domain model; `src/lib/atproto/records.ts` maps between them.

Records read from the network are validated against these schemas (`src/lib/atproto/schemas.ts`) and dropped when they don't match.

`radio.4000.chat.message` can point at a track (`track`, an at:// URI). It has no `facets`, `langs` or `reply` yet: optional fields can be added to a published lexicon, so they come with the features that use them. The `large-string` lint is ignored: track descriptions allow 30,000 bytes, as imported radio4000.com descriptions may be long.

Everything in a repo is public. Nothing private goes in a record: settings that aren't meant to be seen stay in the browser.

Imported radio4000.com tracks get TIDs made from their original add date, so they sort among new tracks by date.

## OAuth

`src/lib/oauth.ts` builds the scope from config and the permission set `radio.4000.authFull` (`lexicons/radio/4000/authFull.json`): the four collections with only the actions the app uses, plus `blob:image/*` for radio images (blobs can't be part of a set). `/client-metadata.json` is a prerendered route built from the same values. Plain-HTTP dev uses a loopback client id carrying the same scope.

Until the permission set is published, the app asks for its permissions as raw scopes (`repo:radio.4000.track …`), which consent screens show as collection names. Once published, it asks for `include:radio.4000.authFull`, and the PDS shows the set's title and description ("Radio4000: manage your radio"), translated where the PDS supports it.

## Publishing the schemas

A PDS finds `radio.4000.*` lexicons, and the permission set, through DNS and a repository:

1. Pick the account that holds the schemas (for example one with the handle `4000.radio`) and note its DID.
2. Add a DNS TXT record on 4000.radio: `_lexicon.4000.radio` with the value `did=<that DID>`.
3. Publish with [goat](https://github.com/bluesky-social/goat): `goat account login` as that account, then `bun run lexicons:publish` (runs `goat lex publish` over `lexicons/`).
4. In `src/lib/config/app.json`, set `oauth.permissionSetPublished` to `true` and deploy. Users signing in from then on see the permission set; existing sessions keep their scopes until they renew permissions in Settings.

`bun run lexicons:lint` checks the schemas.
