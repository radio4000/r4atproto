/**
 * Live record changes from Bluesky's public Jetstream (a JSON view of the firehose),
 * filtered to some collections. One socket per subscription, reconnecting with backoff.
 */
import app from '../config/app.json' with {type: 'json'}
import {isValidRecord} from './schemas'

export interface CommitEvent<T = unknown> {
	did: string
	time_us: number
	kind: 'commit'
	commit: {
		operation: 'create' | 'update' | 'delete'
		collection: string
		rkey: string
		record?: T
	}
}

export function subscribe<T>(collections: string[], onEvent: (event: CommitEvent<T>) => void) {
	let socket: WebSocket | undefined
	let retry = 0
	let timer: ReturnType<typeof setTimeout> | undefined
	let closed = false

	function connect() {
		const url = new URL(app.services.jetstream)
		for (const collection of collections) url.searchParams.append('wantedCollections', collection)
		socket = new WebSocket(url)
		socket.onopen = () => (retry = 0)
		socket.onmessage = (message) => {
			let event: CommitEvent<T>
			try {
				event = JSON.parse(message.data)
			} catch {
				return
			}
			if (event.kind !== 'commit' || typeof event.did !== 'string' || !event.commit) return
			// Creates and updates must match their lexicon; deletes carry no record
			const {operation, collection, record} = event.commit
			if (operation !== 'delete' && !isValidRecord(collection, record)) return
			onEvent(event)
		}
		socket.onclose = () => {
			if (closed) return
			// 1s, 2s, 4s … up to a minute
			timer = setTimeout(connect, Math.min(60_000, 1000 * 2 ** retry++))
		}
	}

	connect()
	return () => {
		closed = true
		clearTimeout(timer)
		socket?.close()
	}
}
