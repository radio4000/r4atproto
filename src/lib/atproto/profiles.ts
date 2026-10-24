/**
 * Bluesky profiles from the public AppView: display name and avatar fallbacks
 * for radios, and handle search.
 */
import app from '../config/app.json' with {type: 'json'}
import {xrpcGet} from './xrpc'

export interface Profile {
	did: string
	handle: string
	displayName?: string
	description?: string
	avatar?: string
}

/** Profiles for up to any number of DIDs or handles (batched by 25, the API limit) */
export async function getProfiles(actors: string[]): Promise<Profile[]> {
	const batches: string[][] = []
	for (let i = 0; i < actors.length; i += 25) batches.push(actors.slice(i, i + 25))
	const results = await Promise.all(
		batches.map((batch) =>
			xrpcGet<{profiles: Profile[]}>(app.services.appview, 'app.bsky.actor.getProfiles', {
				actors: batch
			}).then((res) => res.profiles)
		)
	)
	return results.flat()
}

export async function searchProfiles(q: string, limit = 25): Promise<Profile[]> {
	const res = await xrpcGet<{actors: Profile[]}>(
		app.services.appview,
		'app.bsky.actor.searchActors',
		{
			q,
			limit
		}
	)
	return res.actors
}
