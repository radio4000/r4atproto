/**
 * Checks records against lexicons: anyone can write any shape of record to their
 * repo, so records read from the network are checked before use. Takes the lexicon
 * documents, so the app (schemas.ts) and the indexer each load them their own way.
 */
import {Lexicons, jsonToLex, type LexiconDoc} from '@atproto/lexicon'

export function recordValidator(docs: LexiconDoc[]) {
	const records = docs.filter((doc) => doc.defs?.main?.type === 'record')
	const lexicons = new Lexicons(records)
	const known = new Set<string>(records.map((doc) => doc.id))

	/** Whether a record (JSON, as read from a repo or Jetstream) matches its lexicon.
	 *  Collections without a lexicon here pass as they are. */
	return function isValidRecord<T>(nsid: string, value: unknown): value is T {
		if (typeof value !== 'object' || value === null) return false
		if (!known.has(nsid)) return true
		try {
			// Blob refs arrive as JSON ({$link}); the validator expects them parsed
			lexicons.assertValidRecord(nsid as never, jsonToLex({$type: nsid, ...value} as never))
			return true
		} catch {
			return false
		}
	}
}
