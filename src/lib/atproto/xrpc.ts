/**
 * Unauthenticated XRPC reads with plain fetch. Only CORS-safelisted headers, so
 * relays and PDSes answer without a preflight (the @atproto/api Agent adds a
 * labelers header that some of them reject).
 */
import {pooledFetch} from './pool'

export type XrpcParams = Record<string, string | number | boolean | string[] | undefined>

export class XrpcError extends Error {
	constructor(
		readonly status: number,
		readonly error: string | undefined,
		message: string
	) {
		super(message)
	}
}

export async function xrpcGet<T>(
	service: string,
	nsid: string,
	params: XrpcParams = {}
): Promise<T> {
	const url = new URL(`/xrpc/${nsid}`, service)
	for (const [key, value] of Object.entries(params)) {
		if (value === undefined) continue
		for (const v of Array.isArray(value) ? value : [value]) url.searchParams.append(key, String(v))
	}
	const res = await pooledFetch(url)
	if (!res.ok) {
		const body = (await res.json().catch(() => ({}))) as {error?: string; message?: string}
		throw new XrpcError(res.status, body.error, body.message || `${nsid} failed (${res.status})`)
	}
	return res.json()
}
