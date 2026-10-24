// A Db on node:sqlite with the index's migrations applied, for tests
import {readFileSync, readdirSync} from 'node:fs'
import {DatabaseSync} from 'node:sqlite'
import type {Db, Statement} from '../src/db'

const migrations = new URL('../migrations/', import.meta.url)

export function testDb(): Db & {sqlite: DatabaseSync} {
	const sqlite = new DatabaseSync(':memory:')
	for (const file of readdirSync(migrations).sort()) {
		sqlite.exec(readFileSync(new URL(file, migrations), 'utf8'))
	}
	const statement = (sql: string, values: unknown[] = []): Statement => ({
		bind: (...next) => statement(sql, next),
		all: async <T>() => ({results: sqlite.prepare(sql).all(...(values as never[])) as T[]}),
		first: async <T>() => (sqlite.prepare(sql).get(...(values as never[])) as T) ?? null,
		run: async () => sqlite.prepare(sql).run(...(values as never[]))
	})
	return {
		sqlite,
		prepare: (sql) => statement(sql),
		async batch(statements) {
			sqlite.exec('BEGIN')
			try {
				const results = []
				for (const s of statements) results.push(await s.run())
				sqlite.exec('COMMIT')
				return results
			} catch (error) {
				sqlite.exec('ROLLBACK')
				throw error
			}
		}
	}
}
