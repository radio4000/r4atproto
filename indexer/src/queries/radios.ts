/** radio.4000.listRadios and radio.4000.getRadios */
import type {Db} from '../db'
import {ftsQuery, offsetOf} from '../search'
import {radioView, type RadioRow} from '../views'

const COLUMNS = 'r.did, r.handle, r.pds, r.record, r.track_count, r.latest_track_at, r.indexed_at'

const ORDER: Record<string, string> = {
	latest: 'r.latest_track_at DESC NULLS LAST, r.did',
	new: 'r.created_at DESC NULLS LAST, r.did',
	tracks: 'r.track_count DESC, r.did'
}

/** 'west,south,east,north' in decimal degrees, or undefined */
export function parseBbox(bbox: string | undefined) {
	const parts = bbox?.split(',').map(Number)
	if (parts?.length !== 4 || parts.some((n) => !Number.isFinite(n))) return undefined
	const [west, south, east, north] = parts as [number, number, number, number]
	return {west, south, east, north}
}

export async function listRadios(
	db: Db,
	params: {q?: string; sort: string; bbox?: string; limit: number; cursor?: string}
) {
	// A radio has a channel record or tracks; an account with neither isn't listed
	const where = ['(r.record IS NOT NULL OR r.track_count > 0)']
	const binds: unknown[] = []
	const match = ftsQuery(params.q)
	if (match) {
		where.push('r.rowid IN (SELECT rowid FROM radios_fts WHERE radios_fts MATCH ?)')
		binds.push(match)
	}
	const box = parseBbox(params.bbox)
	if (box) {
		where.push('r.latitude BETWEEN ? AND ?')
		binds.push(box.south, box.north)
		// An area across the antimeridian has west > east
		where.push(
			box.west <= box.east
				? 'r.longitude BETWEEN ? AND ?'
				: '(r.longitude >= ? OR r.longitude <= ?)'
		)
		binds.push(box.west, box.east)
	}
	const offset = offsetOf(params.cursor)
	const {results} = await db
		.prepare(
			`SELECT ${COLUMNS} FROM radios r WHERE ${where.join(' AND ')}
			ORDER BY ${ORDER[params.sort] ?? ORDER.latest} LIMIT ? OFFSET ?`
		)
		.bind(...binds, params.limit + 1, offset)
		.all<RadioRow>()
	const more = results.length > params.limit
	return {
		radios: results.slice(0, params.limit).map(radioView),
		cursor: more ? String(offset + params.limit) : undefined
	}
}

export async function getRadios(db: Db, params: {dids: string[]}) {
	const {results} = await db
		.prepare(`SELECT ${COLUMNS} FROM radios r WHERE r.did IN (SELECT value FROM json_each(?))`)
		.bind(JSON.stringify(params.dids))
		.all<RadioRow>()
	const byDid = new Map(results.map((row) => [row.did, row]))
	return {
		radios: params.dids.flatMap((did) => (byDid.has(did) ? [radioView(byDid.get(did)!)] : []))
	}
}
