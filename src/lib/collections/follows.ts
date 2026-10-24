/**
 * DIDs of the radios the signed-in account follows (radio.4000.follow records).
 */
import {createCollection} from '@tanstack/svelte-db'
import {queryCollectionOptions} from '@tanstack/query-db-collection'
import {FOLLOW} from '#lib/lexicons.js'
import {listAllRecords} from '#lib/atproto/repo.js'
import {followRkey, type FollowRecord} from '#lib/atproto/records.js'
import {deleteRecord, myDid, putRecord} from '#lib/atproto/write.js'
import {queryClient} from './query-client'

export const followsCollection = createCollection(
	queryCollectionOptions({
		queryKey: ['follows'],
		queryClient,
		getKey: (item: {id: string}) => item.id,
		staleTime: 5 * 60 * 1000,
		queryFn: async (): Promise<{id: string}[]> => {
			const did = myDid()
			if (!did) return []
			const records = await listAllRecords<FollowRecord>(did, FOLLOW)
			return [...new Set(records.map((r) => r.value.subject))].map((id) => ({id}))
		}
	})
)

/** Refetch after signing in or out */
export function loadUserFollows() {
	return followsCollection.utils.refetch()
}

/** Optimistically follow a radio; rolls back on failure. */
export async function followChannel(did: string) {
	followsCollection.utils.writeInsert({id: did})
	try {
		await putRecord(FOLLOW, followRkey(did), {
			$type: FOLLOW,
			subject: did,
			createdAt: new Date().toISOString()
		})
	} catch (error) {
		followsCollection.utils.writeDelete(did)
		throw error
	}
}

/** Optimistically unfollow a radio; rolls back on failure. */
export async function unfollowChannel(did: string) {
	followsCollection.utils.writeDelete(did)
	try {
		await deleteRecord(FOLLOW, followRkey(did))
	} catch (error) {
		followsCollection.utils.writeInsert({id: did})
		throw error
	}
}
