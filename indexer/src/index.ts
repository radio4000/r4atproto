/**
 * The 4000.radio index (an atproto AppView for radio.4000.*): XRPC queries over HTTP,
 * the live ingest (a Durable Object), and repo backfills (a Queue).
 */
import {resolveIdentityFresh} from '#lib/atproto/identity.js'
import {backfillRepo, listIndexedRepos} from './backfill'
import {handleXrpc} from './xrpc'

export {Ingest} from './ingest'

const ingest = (env: Env) => env.INGEST.get(env.INGEST.idFromName('jetstream'))

const authorized = (request: Request, env: Env) =>
	Boolean(env.ADMIN_TOKEN) && request.headers.get('authorization') === `Bearer ${env.ADMIN_TOKEN}`

export default {
	async fetch(request, env, ctx) {
		const url = new URL(request.url)
		if (request.method === 'OPTIONS') {
			return new Response(null, {
				headers: {'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET'}
			})
		}
		if (url.pathname.startsWith('/xrpc/') && request.method === 'GET') {
			// Visitors share answers for indexer.cacheSeconds
			const cache = caches.default
			const hit = await cache.match(request)
			if (hit) return hit
			const response = await handleXrpc(env.DB, url)
			if (response.ok) ctx.waitUntil(cache.put(request, response.clone()))
			return response
		}
		if (url.pathname.startsWith('/admin/') && !authorized(request, env)) {
			return new Response('Unauthorized', {status: 401})
		}
		// Whether the ingest is connected, and its Jetstream position
		if (url.pathname === '/admin/ingest') return ingest(env).fetch('https://ingest/start')
		if (url.pathname === '/admin/backfill' && request.method === 'POST') {
			const dids = await listIndexedRepos()
			for (let i = 0; i < dids.length; i += 100) {
				await env.BACKFILL.sendBatch(dids.slice(i, i + 100).map((did) => ({body: {did}})))
			}
			await ingest(env).fetch('https://ingest/start')
			return Response.json({queued: dids.length})
		}
		if (url.pathname === '/') return new Response('4000.radio index: GET /xrpc/radio.4000.*')
		return new Response('Not found', {status: 404})
	},

	async queue(batch, env) {
		for (const message of batch.messages) {
			const {did} = message.body as {did: string}
			await backfillRepo(env.DB, await resolveIdentityFresh(did))
			message.ack()
		}
	},

	async scheduled(_controller, env) {
		await ingest(env).fetch('https://ingest/start')
	}
} satisfies ExportedHandler<Env>
