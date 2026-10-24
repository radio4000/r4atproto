/** The part of D1 the indexer uses, so tests can run it on node:sqlite */
export interface Statement {
	bind(...values: unknown[]): Statement
	all<T = Record<string, unknown>>(): Promise<{results: T[]}>
	first<T = Record<string, unknown>>(): Promise<T | null>
	run(): Promise<unknown>
}

export interface Db {
	prepare(sql: string): Statement
	/** Runs the statements in one transaction */
	batch(statements: Statement[]): Promise<unknown[]>
}
