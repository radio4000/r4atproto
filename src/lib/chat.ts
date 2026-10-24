/**
 * Public chat rooms, one per radio. A message is a radio.4000.chat.message record
 * in the sender's repo, pointing at the radio (subject). History comes from
 * Constellation, a public backlinks index of the network; live messages from Jetstream.
 */
import {TID} from '@atproto/common-web'
import app from '#lib/config/app.json' with {type: 'json'}
import {CHAT_MESSAGE} from '#lib/lexicons.js'
import {resolveIdentity} from '#lib/atproto/identity.js'
import {getProfiles} from '#lib/atproto/profiles.js'
import {getRecord, parseAtUri} from '#lib/atproto/repo.js'
import {subscribe} from '#lib/atproto/jetstream.js'
import {xrpcGet} from '#lib/atproto/xrpc.js'
import {createRecord, deleteRecord, myDid} from '#lib/atproto/write.js'

export interface ChatMessageRecord {
	$type?: string
	subject: string
	text: string
	createdAt: string
}

export interface ChatMessage {
	/** at:// URI of the record */
	id: string
	/** DID of the sender */
	did: string
	handle: string
	avatar?: string
	text: string
	created_at: string
}

const CONCURRENCY = 6
const avatars = new Map<string, string | undefined>()

async function author(did: string): Promise<{handle: string; avatar?: string}> {
	const identity = await resolveIdentity(did).catch(() => ({handle: did}))
	if (!avatars.has(did)) {
		const [profile] = await getProfiles([did]).catch(() => [])
		avatars.set(did, profile?.avatar)
	}
	return {handle: identity.handle, avatar: avatars.get(did)}
}

async function toMessage(uri: string, record: ChatMessageRecord): Promise<ChatMessage> {
	const {did} = parseAtUri(uri)
	return {id: uri, did, ...(await author(did)), text: record.text, created_at: record.createdAt}
}

/** The latest messages of a radio's room, oldest first */
export async function fetchChatHistory(radioDid: string): Promise<ChatMessage[]> {
	const {records} = await xrpcGet<{records: {did: string; collection: string; rkey: string}[]}>(
		app.services.constellation,
		'blue.microcosm.links.getBacklinks',
		{subject: radioDid, source: `${CHAT_MESSAGE}:subject`, limit: app.chat.historySize}
	)
	const messages: ChatMessage[] = []
	for (let i = 0; i < records.length; i += CONCURRENCY) {
		const batch = await Promise.all(
			records.slice(i, i + CONCURRENCY).map(async ({did, rkey}) => {
				const record = await getRecord<ChatMessageRecord>(did, CHAT_MESSAGE, rkey).catch(() => null)
				return record ? toMessage(record.uri, record.value) : null
			})
		)
		for (const message of batch) if (message) messages.push(message)
	}
	return messages.toSorted((a, b) => a.created_at.localeCompare(b.created_at))
}

/** New and deleted messages of a radio's room, live. Returns the unsubscribe function. */
export function watchChat(
	radioDid: string,
	handlers: {added: (message: ChatMessage) => void; removed: (id: string) => void}
) {
	return subscribe<ChatMessageRecord>([CHAT_MESSAGE], async ({did, commit}) => {
		const uri = `at://${did}/${commit.collection}/${commit.rkey}`
		if (commit.operation === 'delete') return handlers.removed(uri)
		if (commit.record?.subject !== radioDid) return
		handlers.added(await toMessage(uri, commit.record))
	})
}

/** Post to a radio's room as the signed-in account; resolves with the message */
export async function sendChatMessage(radioDid: string, text: string): Promise<ChatMessage> {
	const did = myDid()
	if (!did) throw new Error('Not signed in')
	const rkey = TID.nextStr()
	const record: ChatMessageRecord = {
		$type: CHAT_MESSAGE,
		subject: radioDid,
		text: text.trim(),
		createdAt: new Date().toISOString()
	}
	await createRecord(CHAT_MESSAGE, record, rkey)
	return toMessage(`at://${did}/${CHAT_MESSAGE}/${rkey}`, record)
}

/** Delete one of the signed-in account's messages */
export function deleteChatMessage(id: string) {
	return deleteRecord(CHAT_MESSAGE, parseAtUri(id).rkey)
}
