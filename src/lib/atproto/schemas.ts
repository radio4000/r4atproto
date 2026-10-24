/**
 * Validation of records against our own lexicons (/lexicons). Anyone can write any
 * shape of record to their repo, so records read from the network are checked here
 * before the app maps them; invalid ones are dropped.
 */
import {Lexicons, jsonToLex, type LexiconDoc} from '@atproto/lexicon'
import {NAMESPACE} from '#lib/lexicons.js'

// Ours, and the ones they refer to (pulled with `goat lex pull`). Permission sets aren't schemas.
const docs = Object.values(
	import.meta.glob<LexiconDoc>('/lexicons/**/*.json', {eager: true, import: 'default'})
).filter((doc) => doc.defs?.main?.type !== 'permission-set')

const lexicons = new Lexicons(docs)

const ours = new Set<string>(
	docs
		.filter((doc) => doc.id.startsWith(`${NAMESPACE}.`) && doc.defs.main?.type === 'record')
		.map((doc) => doc.id)
)

/** Whether a record (JSON, as read from a repo or Jetstream) matches its lexicon.
 *  Collections without a lexicon of ours pass as they are. */
export function isValidRecord<T>(nsid: string, value: unknown): value is T {
	if (typeof value !== 'object' || value === null) return false
	if (!ours.has(nsid)) return true
	try {
		// Blob refs arrive as JSON ({$link}); the validator expects them parsed
		lexicons.assertValidRecord(nsid as never, jsonToLex({$type: nsid, ...value} as never))
		return true
	} catch {
		return false
	}
}
