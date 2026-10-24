/**
 * Validation of records against our own lexicons (/lexicons), before the app maps
 * them; invalid ones are dropped.
 */
import type {LexiconDoc} from '@atproto/lexicon'
import {recordValidator} from './lexicon-validator'

export const isValidRecord = recordValidator(
	Object.values(
		import.meta.glob<LexiconDoc>('/lexicons/**/*.json', {eager: true, import: 'default'})
	)
)
