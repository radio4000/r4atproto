/**
 * Live broadcasts, keyed by channel DID. Filled from radio.4000.broadcast
 * records once broadcast is wired up; empty until then.
 */
import {createCollection} from '@tanstack/svelte-db'
import {localOnlyCollectionOptions} from '@tanstack/db'
import type {Broadcast} from '#lib/types.js'

export const broadcastsCollection = createCollection(
	localOnlyCollectionOptions({
		id: 'broadcasts',
		getKey: (item: Broadcast) => item.channel_id
	})
)
