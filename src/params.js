import {defineParams} from '@sveltejs/kit/params'

export const params = defineParams({
	/** A radio's path segment: @ followed by a handle (or a DID) */
	/** @param {string} param */
	handle: (param) => (/^@[\w.:-]+$/.test(param) ? param : undefined)
})
