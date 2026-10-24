/**
 * The live ingest: one Durable Object holding one Jetstream connection, filtered to
 * radio.4000.*. Events are applied in small batches; the position (cursor) is saved
 * after each, so a restart resumes where it stopped, a few seconds early (writes are
 * idempotent).
 */
import {DurableObject} from 'cloudflare:workers'
import app from '#lib/config/app.json' with {type: 'json'}
import {resolveIdentityFresh} from '#lib/atproto/identity.js'
import {processEvents, type JetstreamEvent} from './events'

const WATCHDOG_MS = 30_000

export class Ingest extends DurableObject<Env> {
	socket?: WebSocket
	buffer: JetstreamEvent[] = []
	flushing: Promise<void> = Promise.resolve()
	timer?: number

	async fetch() {
		await this.connect()
		return new Response(
			JSON.stringify({connected: Boolean(this.socket), cursor: await this.cursor()})
		)
	}

	async alarm() {
		await this.connect()
		await this.ctx.storage.setAlarm(Date.now() + WATCHDOG_MS)
	}

	cursor() {
		return this.ctx.storage.get<number>('cursor')
	}

	async connect() {
		if (this.socket) return
		const url = new URL(app.services.jetstream)
		url.protocol = 'https:'
		url.searchParams.append('wantedCollections', `${app.namespace}.*`)
		const cursor = await this.cursor()
		if (cursor)
			url.searchParams.set('cursor', String(cursor - app.indexer.cursorRewindSeconds * 1e6))
		const res = await fetch(url, {headers: {Upgrade: 'websocket'}})
		const socket = res.webSocket
		if (!socket) throw new Error(`Jetstream refused the connection (${res.status})`)
		socket.accept()
		socket.addEventListener('message', (message) => {
			try {
				this.buffer.push(JSON.parse(String(message.data)))
			} catch {
				return
			}
			if (this.buffer.length >= app.indexer.flushSize) this.flush()
		})
		const closed = () => {
			this.socket = undefined
			if (this.timer) clearInterval(this.timer)
		}
		socket.addEventListener('close', closed)
		socket.addEventListener('error', closed)
		this.socket = socket
		this.timer = setInterval(() => this.flush(), app.indexer.flushMs)
		if ((await this.ctx.storage.getAlarm()) == null)
			await this.ctx.storage.setAlarm(Date.now() + WATCHDOG_MS)
	}

	/** Apply buffered events, one batch at a time */
	flush() {
		this.flushing = this.flushing
			.then(async () => {
				const events = this.buffer.splice(0)
				if (!events.length) return
				await processEvents(this.env.DB, events, {
					resolve: resolveIdentityFresh,
					backfill: async (did) => {
						await this.env.BACKFILL.send({did})
					}
				})
				await this.ctx.storage.put('cursor', events.at(-1)!.time_us)
			})
			.catch((error) => console.error('ingest flush failed', error))
		return this.flushing
	}
}
