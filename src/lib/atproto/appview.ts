/**
 * Reads from the 4000.radio index (services.index, our AppView for radio.4000.*,
 * see docs/indexer.md). Each read has a direct fallback: reading repos from the
 * browser, as without an index. When the index fails, it is left alone for
 * indexer.retrySeconds and the fallback is used.
 */
import app from '../config/app.json' with {type: 'json'}
import {xrpcGet, type XrpcParams} from './xrpc'

let downUntil = 0

export const indexAvailable = () => app.indexer.enabled && Date.now() >= downUntil

export function indexGet<T>(query: string, params: XrpcParams = {}): Promise<T> {
	return xrpcGet<T>(app.services.index, `${app.namespace}.${query}`, params)
}

/** The index's answer, else the direct read's */
export async function fromIndex<T>(read: () => Promise<T>, fallback: () => Promise<T>): Promise<T> {
	if (!indexAvailable()) return fallback()
	try {
		return await read()
	} catch (error) {
		console.warn('index unavailable, reading repos directly', error)
		downUntil = Date.now() + app.indexer.retrySeconds * 1000
		return fallback()
	}
}
