import {readdirSync, readFileSync} from 'node:fs'
import {join} from 'node:path'
import {expect, test} from 'vitest'
import {AUTH, BROADCAST, CHANNEL, CHAT_MESSAGE, FOLLOW, NAMESPACE, TRACK} from './lexicons'

const dir = `lexicons/${NAMESPACE.split('.').join('/')}`

function schemaIds(path: string): string[] {
	return readdirSync(path, {withFileTypes: true}).flatMap((entry) =>
		entry.isDirectory()
			? schemaIds(join(path, entry.name))
			: [JSON.parse(readFileSync(join(path, entry.name), 'utf8')).id]
	)
}

test('every lexicon schema lives under the configured namespace', () => {
	// Records, the sign-in permission set, and the index's queries with their views
	const queries = [
		'defs',
		'listRadios',
		'getRadios',
		'listTracks',
		'listBroadcasts',
		'chat.listMessages'
	]
	expect(schemaIds(dir).sort()).toEqual(
		[
			AUTH,
			BROADCAST,
			CHANNEL,
			CHAT_MESSAGE,
			FOLLOW,
			TRACK,
			...queries.map((q) => `${NAMESPACE}.${q}`)
		].sort()
	)
})
