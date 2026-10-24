/**
 * Every public read goes through here. PDSes and the services in front of them
 * rate-limit by IP, and a page of many radios reads from many of them at once, so
 * each host gets at most reads.perHost requests in flight. A host answering 429
 * is paused for as long as it asks (Retry-After or RateLimit-Reset, else a growing
 * delay) and the read is retried, up to reads.retries times.
 */
import app from '../config/app.json' with {type: 'json'}

interface Host {
	active: number
	queue: (() => void)[]
	/** No new requests to this host before this time (ms) */
	pausedUntil: number
}

const hosts = new Map<string, Host>()

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function host(url: URL): Host {
	let entry = hosts.get(url.host)
	if (!entry) {
		entry = {active: 0, queue: [], pausedUntil: 0}
		hosts.set(url.host, entry)
	}
	return entry
}

/** Wait for a free slot on the host, then hold it */
async function acquire(entry: Host) {
	if (entry.active >= app.reads.perHost) {
		await new Promise<void>((resolve) => entry.queue.push(resolve))
	}
	entry.active++
	const wait = entry.pausedUntil - Date.now()
	if (wait > 0) await sleep(wait)
}

function release(entry: Host) {
	entry.active--
	entry.queue.shift()?.()
}

/** How long a 429 asks to wait (ms), from its headers, else backoff for the attempt */
export function retryDelay(headers: Headers, attempt: number, now = Date.now()): number {
	const retryAfter = headers.get('retry-after')
	if (retryAfter) {
		const seconds = Number(retryAfter)
		if (Number.isFinite(seconds)) return seconds * 1000
		const date = Date.parse(retryAfter)
		if (Number.isFinite(date)) return Math.max(0, date - now)
	}
	// atproto PDSes send the reset as a Unix time in seconds
	const reset = Number(headers.get('ratelimit-reset'))
	if (reset > 0) return Math.max(0, reset * 1000 - now)
	return app.reads.backoffMs * 2 ** attempt
}

/** fetch, limited per host and retried on 429 */
export async function pooledFetch(input: string | URL): Promise<Response> {
	const url = new URL(input)
	const entry = host(url)
	for (let attempt = 0; ; attempt++) {
		await acquire(entry)
		let res: Response
		try {
			res = await fetch(input)
		} finally {
			release(entry)
		}
		if (res.status !== 429 || attempt >= app.reads.retries) return res
		const delay = Math.min(retryDelay(res.headers, attempt), app.reads.maxBackoffMs)
		entry.pausedUntil = Math.max(entry.pausedUntil, Date.now() + delay)
		await sleep(delay)
	}
}
