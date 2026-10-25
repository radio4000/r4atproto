/**
 * The live ingest: one Durable Object holding one Jetstream connection, filtered to
 * radio.4000.*. Events are applied in small batches; the position (cursor) is saved
 * after each, so a restart resumes where it stopped, a few seconds early (writes are
 * idempotent). Starting without a position Jetstream still holds (the first start,
 * or after a long outage), it backfills every repo the relay lists.
 */
import {DurableObject} from 'cloudflare:workers'
import app from '#lib/config/app.json' with {type: 'json'}
import {resolveIdentityFresh} from '#lib/atproto/identity.js'
import {listIndexedRepos} from './backfill'
import {processEvents, type JetstreamEvent} from './events'

const WATCHDOG_MS = 30_000

export class Ingest extends DurableObject<Env> {
	socket?: WebSocket
	buffer: JetstreamEvent[] = []
	flushing: Promise<void> = Promise.resolve()
	timer?: number
	connecting?: Promise<void>
	backfilling?: Promise<void>

	/** Whether the ingest is connected, its Jetstream position, and whether a backfill is due */
	async fetch() {
		await this.start()
		return Response.json({
			connected: Boolean(this.socket),
			cursor: (await this.cursor()) ?? null,
			backfill: await this.backfillDue()
		})
	}

	async alarm() {
		await this.ctx.storage.setAlarm(Date.now() + WATCHDOG_MS)
		await this.start()
	}

	async start() {
		await this.connect()
		await this.catchUp()
	}

	cursor() {
		return this.ctx.storage.get<number>('cursor')
	}

	connect() {
		this.connecting ??= this.open().finally(() => (this.connecting = undefined))
		return this.connecting
	}

	async open() {
		if (this.socket) return
		const url = new URL(app.services.jetstream)
		url.protocol = 'https:'
		url.searchParams.append('wantedCollections', `${app.namespace}.*`)
		const cursor = await this.cursor()
		const oldest = (Date.now() - app.indexer.jetstreamRetentionHours * 3600e3) * 1000
		if (cursor && cursor > oldest)
			url.searchParams.set('cursor', String(cursor - app.indexer.cursorRewindSeconds * 1e6))
		else await this.ctx.storage.put('backfill', true)
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

	/** Due until a first full backfill is done, and again after a start without a usable position */
	async backfillDue() {
		const [due, done] = await Promise.all([
			this.ctx.storage.get('backfill'),
			this.ctx.storage.get('backfilled')
		])
		return Boolean(due) || !done
	}

	/** Queue every repo the relay lists, when a backfill is due */
	async catchUp() {
		if (!(await this.backfillDue())) return
		this.backfilling ??= this.backfill().finally(() => (this.backfilling = undefined))
		await this.backfilling
	}

	async backfill() {
		const dids = await listIndexedRepos()
		for (let i = 0; i < dids.length; i += 100) {
			await this.env.BACKFILL.sendBatch(dids.slice(i, i + 100).map((did) => ({body: {did}})))
		}
		// A position, so a restart before the first event does not backfill again
		if (!(await this.cursor())) await this.ctx.storage.put('cursor', Date.now() * 1000)
		await this.ctx.storage.put('backfilled', true)
		await this.ctx.storage.delete('backfill')
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
