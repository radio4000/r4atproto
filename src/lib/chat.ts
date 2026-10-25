/**
 * Public chat rooms, one per radio. A message is a radio.4000.chat.message record
 * in the sender's repo, pointing at the radio (subject). History comes from the
 * 4000.radio index (else Constellation, a public backlinks index); live messages
 * from Jetstream.
 */
import {TID} from '@atproto/common-web'
import app from '#lib/config/app.json' with {type: 'json'}
import {CHAT_MESSAGE, TRACK} from '#lib/lexicons.js'
import {resolveIdentity} from '#lib/atproto/identity.js'
import {getProfiles} from '#lib/atproto/profiles.js'
import {getRecord, parseAtUri} from '#lib/atproto/repo.js'
import {subscribe} from '#lib/atproto/jetstream.js'
import {xrpcGet} from '#lib/atproto/xrpc.js'
import {createRecord, deleteRecord, myDid} from '#lib/atproto/write.js'
import {fromIndex, indexGet} from '#lib/atproto/appview.js'
import {isChatMessage, type RecordView} from '#lib/atproto/index-views.js'

export interface ChatMessageRecord {
	$type?: string
	subject: string
	text: string
	/** at:// URI of a track record */
	track?: string
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
	/** at:// URI of the track the message is about */
	track?: string
	created_at: string
}

const CONCURRENCY = 6
const avatars = new Map<string, string | undefined>()

async function avatarOf(did: string): Promise<string | undefined> {
	if (!avatars.has(did)) {
		const [profile] = await getProfiles([did]).catch(() => [])
		avatars.set(did, profile?.avatar)
	}
	return avatars.get(did)
}

async function author(did: string): Promise<{handle: string; avatar?: string}> {
	const identity = await resolveIdentity(did).catch(() => ({handle: did}))
	return {handle: identity.handle, avatar: await avatarOf(did)}
}

/** The latest messages of a room from the index, newest first */
function messagesFromIndex(radioDid: string) {
	return indexGet<{messages: RecordView[]}>('chat.listMessages', {
		radio: radioDid,
		limit: app.chat.historySize
	}).then(({messages}) => messages.filter(isChatMessage))
}

function messageOf(
	uri: string,
	record: ChatMessageRecord,
	sender: {handle: string; avatar?: string}
): ChatMessage {
	const track = record.track
	return {
		id: uri,
		did: parseAtUri(uri).did,
		...sender,
		text: record.text,
		// at://did/collection/rkey
		track: track?.split('/')[3] === TRACK ? track : undefined,
		created_at: record.createdAt
	}
}

async function toMessage(uri: string, record: ChatMessageRecord): Promise<ChatMessage> {
	return messageOf(uri, record, await author(parseAtUri(uri).did))
}

/** Sender and record key of the latest messages of a radio's room (records not fetched) */
export function fetchChatRefs(radioDid: string): Promise<{did: string; rkey: string}[]> {
	return fromIndex(
		async () =>
			(await messagesFromIndex(radioDid)).map((view) => ({
				did: view.author.did,
				rkey: parseAtUri(view.uri).rkey
			})),
		() => chatRefsFromConstellation(radioDid)
	)
}

async function chatRefsFromConstellation(radioDid: string) {
	const {records} = await xrpcGet<{records: {did: string; collection: string; rkey: string}[]}>(
		app.services.constellation,
		'blue.microcosm.links.getBacklinks',
		{subject: radioDid, source: `${CHAT_MESSAGE}:subject`, limit: app.chat.historySize}
	)
	return records
}

/** The latest messages of a radio's room, oldest first */
export function fetchChatHistory(radioDid: string): Promise<ChatMessage[]> {
	return fromIndex(
		async () => {
			const views = await messagesFromIndex(radioDid)
			// The index knows each sender's handle; avatars come from Bluesky profiles
			const messages = await Promise.all(
				views.map(async (view) =>
					messageOf(view.uri, view.record as ChatMessageRecord, {
						handle: view.author.handle,
						avatar: await avatarOf(view.author.did)
					})
				)
			)
			return messages.toReversed()
		},
		() => chatHistoryFromRepos(radioDid)
	)
}

async function chatHistoryFromRepos(radioDid: string): Promise<ChatMessage[]> {
	const records = await chatRefsFromConstellation(radioDid)
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

/** Post to a radio's room as the signed-in account, optionally about a track;
 *  resolves with the message */
export async function sendChatMessage(
	radioDid: string,
	text: string,
	track?: string
): Promise<ChatMessage> {
	const did = myDid()
	if (!did) throw new Error('Not signed in')
	const rkey = TID.nextStr()
	const record: ChatMessageRecord = {
		$type: CHAT_MESSAGE,
		subject: radioDid,
		text: text.trim(),
		track,
		createdAt: new Date().toISOString()
	}
	await createRecord(CHAT_MESSAGE, record, rkey)
	return toMessage(`at://${did}/${CHAT_MESSAGE}/${rkey}`, record)
}

/** Delete one of the signed-in account's messages */
export function deleteChatMessage(id: string) {
	return deleteRecord(CHAT_MESSAGE, parseAtUri(id).rkey)
}
