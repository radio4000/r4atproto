import {afterEach, expect, test, vi} from 'vitest'
import {pooledFetch, retryDelay} from './pool'
import app from '../config/app.json' with {type: 'json'}

afterEach(() => vi.unstubAllGlobals())

test('retry delay comes from Retry-After, RateLimit-Reset, else backoff', () => {
	const now = 1_000_000
	expect(retryDelay(new Headers({'retry-after': '2'}), 0, now)).toBe(2000)
	expect(retryDelay(new Headers({'ratelimit-reset': '1003'}), 0, now)).toBe(3000)
	expect(retryDelay(new Headers(), 2, now)).toBe(app.reads.backoffMs * 4)
})

test('keeps at most reads.perHost requests in flight per host', async () => {
	let active = 0
	let peak = 0
	vi.stubGlobal('fetch', async () => {
		peak = Math.max(peak, ++active)
		await new Promise((resolve) => setTimeout(resolve, 5))
		active--
		return new Response('{}')
	})
	await Promise.all(Array.from({length: 20}, (_, i) => pooledFetch(`https://a.test/${i}`)))
	expect(peak).toBe(app.reads.perHost)
})

test('a 429 is retried after the delay the host asks for', async () => {
	const responses = [
		new Response('', {status: 429, headers: {'retry-after': '0'}}),
		new Response('ok')
	]
	const fetch = vi.fn(async () => responses.shift()!)
	vi.stubGlobal('fetch', fetch)
	const res = await pooledFetch('https://b.test/x')
	expect(await res.text()).toBe('ok')
	expect(fetch).toHaveBeenCalledTimes(2)
})

test('gives up after reads.retries and returns the 429', async () => {
	const fetch = vi.fn(async () => new Response('', {status: 429, headers: {'retry-after': '0'}}))
	vi.stubGlobal('fetch', fetch)
	expect((await pooledFetch('https://c.test/x')).status).toBe(429)
	expect(fetch).toHaveBeenCalledTimes(app.reads.retries + 1)
})
