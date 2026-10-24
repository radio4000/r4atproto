# Lexicons

The namespace is set once in `src/lib/config/app.json` (`radio.4000`, the reverse of the 4000.radio domain). `src/lib/lexicons.ts` derives every NSID from it; code never spells an NSID out. The schemas live in `lexicons/radio/4000/`, and a test checks they match the configured namespace.

| NSID                   | rkey             | What                                                                                       |
| ---------------------- | ---------------- | ------------------------------------------------------------------------------------------ |
| `radio.4000.track`     | TID              | A media URL with title, description (#tags, @mentions), Discogs URL, duration              |
| `radio.4000.channel`   | `self`           | The account's radio: name, description, image, link, public coarse location (`geo`), theme |
| `radio.4000.follow`    | from subject DID | Following another radio; one record per followed DID                                       |
| `radio.4000.broadcast` | `self`           | What a radio plays live, per deck. Deleted when the broadcast ends                         |

Records use camelCase as in the lexicons. The app's `Track` type is snake_case like r4's domain model; `src/lib/services/atproto/track-record.ts` maps between them.

Everything in a repo is public. Nothing private goes in a record: settings that aren't meant to be seen stay in the browser.

Imported radio4000.com tracks get TIDs made from their original add date, so they sort among new tracks by date.

## OAuth

`src/lib/oauth.ts` builds the granular scope (`repo:` per collection, `blob:image/*`) and the client metadata from the same config. `/client-metadata.json` is a prerendered route, so there is no hand-maintained metadata file. Plain-HTTP dev uses a loopback client id carrying the same scope.

## Publishing the schemas

Not done yet. Lexicon resolution needs a DNS TXT record `_lexicon.4000.radio` with `did=<did of the account holding the schemas>`, and the schemas as `com.atproto.lexicon.schema` records (rkey = NSID) in that repo.
