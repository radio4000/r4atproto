import {createContext} from 'svelte'
import type {Channel, Track} from '#lib/types.js'

/** The radio of a /@handle page, shared by its sub pages */
export const [getChannelCtx, setChannelCtx] = createContext<{
	readonly slug: string
	readonly data: Channel | undefined
	readonly isReady: boolean
	readonly canEdit: boolean
}>()

/** All tracks of that radio, newest first */
export const [getTracksQueryCtx, setTracksQueryCtx] = createContext<{
	readonly data: Track[]
	readonly isReady: boolean
}>()
