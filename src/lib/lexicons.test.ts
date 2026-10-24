import {readdirSync, readFileSync} from 'node:fs'
import {expect, test} from 'vitest'
import {BROADCAST, CHANNEL, FOLLOW, NAMESPACE, TRACK} from './lexicons'

const dir = `lexicons/${NAMESPACE.split('.').join('/')}`

test('every lexicon schema lives under the configured namespace', () => {
	const ids = readdirSync(dir).map((f) => JSON.parse(readFileSync(`${dir}/${f}`, 'utf8')).id)
	expect(ids.sort()).toEqual([BROADCAST, CHANNEL, FOLLOW, TRACK].sort())
})
