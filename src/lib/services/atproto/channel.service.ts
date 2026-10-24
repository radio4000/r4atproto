/**
 * radio.4000.channel: the single channel record of an account (rkey "self").
 */
import {CHANNEL, SELF} from '../../lexicons'
import {assertAgent, fetchWithAgentFallback, withDpopRetry} from '../../utils/atproto-client'

export interface ChannelTheme {
	mode?: 'auto' | 'light' | 'dark'
	lightBackground?: string
	lightForeground?: string
	lightAccent?: string
	darkBackground?: string
	darkForeground?: string
	darkAccent?: string
}

export interface ChannelRecord {
	$type?: string
	name?: string
	description?: string
	image?: unknown
	url?: string
	geo?: {latitude: string; longitude: string}
	theme?: ChannelTheme
	r4Slug?: string
	createdAt: string
	updatedAt?: string
}

function isNotFound(err: unknown) {
	const msg = String((err as Error)?.message || err).toLowerCase()
	return msg.includes('record not found') || msg.includes('could not locate record')
}

/** The channel record of `did`, or null when the account has none yet. */
export async function getChannel(did: string): Promise<ChannelRecord | null> {
	try {
		const res = await fetchWithAgentFallback(
			(agent) => agent.com.atproto.repo.getRecord({repo: did, collection: CHANNEL, rkey: SELF}),
			{did}
		)
		return (res.data?.value as unknown as ChannelRecord) ?? null
	} catch (err) {
		if (isNotFound(err)) return null
		throw err
	}
}

/** Merge `changes` into the signed-in account's channel record, creating it if needed. */
export async function updateChannel(changes: Partial<Omit<ChannelRecord, '$type' | 'createdAt'>>) {
	const agent = assertAgent()
	const repo = agent.accountDid!
	const existing = await getChannel(repo)
	const now = new Date().toISOString()
	const record: ChannelRecord = {
		...existing,
		...changes,
		$type: CHANNEL,
		createdAt: existing?.createdAt ?? now,
		updatedAt: now
	}
	return withDpopRetry(() =>
		agent.com.atproto.repo.putRecord({repo, collection: CHANNEL, rkey: SELF, record})
	)
}
