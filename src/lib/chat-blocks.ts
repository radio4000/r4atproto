/**
 * Who is out of a chat room, by Bluesky's blocks. Bluesky's AppView knows every
 * block of the network and answers who blocks whom (app.bsky.graph.getRelationships),
 * so a room asks it about its authors: those the radio's owner blocks (or who block
 * the owner) are out of the room, and so are those blocking or blocked by the reader.
 */
import app from '#lib/config/app.json' with {type: 'json'}
import {xrpcGet} from '#lib/atproto/xrpc.js'

interface Relationship {
	did?: string
	blocking?: string
	blockedBy?: string
	blockingByList?: string
	blockedByList?: string
}

/** The AppView answers about at most this many accounts per request */
const PER_REQUEST = 30

/** "actor other" → whether a block stands between them */
const known = new Map<string, Promise<boolean>>()

const blocks = (r: Relationship) =>
	Boolean(r.blocking || r.blockedBy || r.blockingByList || r.blockedByList)

/** Whether a block stands between `actor` and each of `others`, in as few requests as possible */
function relations(actor: string, others: string[]): Promise<boolean>[] {
	const missing = [...new Set(others)].filter(
		(did) => did !== actor && !known.has(`${actor} ${did}`)
	)
	for (let i = 0; i < missing.length; i += PER_REQUEST) {
		const chunk = missing.slice(i, i + PER_REQUEST)
		const answer = xrpcGet<{relationships: Relationship[]}>(
			app.services.appview,
			'app.bsky.graph.getRelationships',
			{actor, others: chunk}
		).then(
			({relationships}) => new Map(relationships.map((r) => [r.did, blocks(r)])),
			() => {
				// Ask again next time
				for (const did of chunk) known.delete(`${actor} ${did}`)
				return new Map<string | undefined, boolean>()
			}
		)
		for (const did of chunk)
			known.set(
				`${actor} ${did}`,
				answer.then((map) => map.get(did) ?? false)
			)
	}
	return others.map((did) => known.get(`${actor} ${did}`) ?? Promise.resolve(false))
}

/** The authors kept out of a radio's room, for a reader (signed in or not) */
export async function roomBlocks(
	radioDid: string,
	readerDid: string | undefined,
	authors: string[]
): Promise<Set<string>> {
	const actors = readerDid && readerDid !== radioDid ? [radioDid, readerDid] : [radioDid]
	const answers = await Promise.all(actors.map((actor) => Promise.all(relations(actor, authors))))
	return new Set(authors.filter((_, i) => answers.some((blocked) => blocked[i])))
}
