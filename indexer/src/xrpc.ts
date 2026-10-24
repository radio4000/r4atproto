/**
 * The index's XRPC queries: GET /xrpc/<nsid>?params. Parameters are read and checked
 * against the query's lexicon (types, limits, defaults), as atproto services do.
 */
import app from '#lib/config/app.json' with {type: 'json'}
import type {Db} from './db'
import {docs, lexicons} from './lexicons'
import {getRadios, listRadios} from './queries/radios'
import {listTracks} from './queries/tracks'
import {listBroadcasts} from './queries/broadcasts'
import {listMessages} from './queries/chat'

type Handler = (db: Db, params: never) => Promise<unknown>

const ns = app.namespace
export const handlers: Record<string, Handler> = {
	[`${ns}.listRadios`]: listRadios,
	[`${ns}.getRadios`]: getRadios,
	[`${ns}.listTracks`]: listTracks,
	[`${ns}.listBroadcasts`]: listBroadcasts,
	[`${ns}.chat.listMessages`]: listMessages
}

type Property = {type: string; items?: {type: string}}

/** Query string → typed parameters, from the lexicon's parameter types */
export function readParams(nsid: string, search: URLSearchParams) {
	const doc = docs.find((d) => d.id === nsid)
	const properties = ((doc?.defs.main as {parameters?: {properties?: Record<string, Property>}})
		?.parameters?.properties ?? {}) as Record<string, Property>
	const typed = (type: string | undefined, value: string) =>
		type === 'integer' ? Number(value) : type === 'boolean' ? value === 'true' : value
	const params: Record<string, unknown> = {}
	for (const [key, property] of Object.entries(properties)) {
		const values = search.getAll(key)
		if (!values.length) continue
		params[key] =
			property.type === 'array'
				? values.map((v) => typed(property.items?.type, v))
				: typed(property.type, values[0]!)
	}
	// Checks limits and formats, and fills in defaults
	return lexicons.assertValidXrpcParams(nsid, params) as Record<string, unknown>
}

const headers = {
	'content-type': 'application/json; charset=utf-8',
	'access-control-allow-origin': '*'
}

const error = (status: number, name: string, message: string) =>
	new Response(JSON.stringify({error: name, message}), {status, headers})

export async function handleXrpc(db: Db, url: URL): Promise<Response> {
	const nsid = url.pathname.slice('/xrpc/'.length)
	const handler = handlers[nsid]
	if (!handler) return error(501, 'MethodNotImplemented', `${nsid} is not served here`)
	let params: Record<string, unknown>
	try {
		params = readParams(nsid, url.searchParams)
	} catch (err) {
		return error(400, 'InvalidRequest', err instanceof Error ? err.message : String(err))
	}
	const body = await handler(db, params as never)
	return new Response(JSON.stringify(body), {
		headers: {...headers, 'cache-control': `public, max-age=${app.indexer.cacheSeconds}`}
	})
}
