// @vitest-environment node
import {readdirSync, readFileSync} from 'node:fs'
import {join} from 'node:path'
import {expect, test} from 'vitest'
import {docs} from '../src/lexicons'

type Doc = {id: string; defs: {main?: {type: string}}}

function read(dir: string): Doc[] {
	return readdirSync(dir, {withFileTypes: true}).flatMap((entry) =>
		entry.isDirectory()
			? read(join(dir, entry.name))
			: [JSON.parse(readFileSync(join(dir, entry.name), 'utf8')) as Doc]
	)
}

test('the indexer loads every lexicon of /lexicons (permission sets aside)', () => {
	const expected = read('lexicons')
		.filter((doc) => doc.defs.main?.type !== 'permission-set')
		.map((doc) => doc.id)
	expect(docs.map((doc) => doc.id).sort()).toEqual(expected.sort())
})
