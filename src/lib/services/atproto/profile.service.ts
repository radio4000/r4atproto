/**
 * Theme of a radio, stored on its radio.4000.channel record.
 */
import type {R4ProfileRecord} from '../../types'
import {getChannel, updateChannel} from './channel.service'

const DEFAULTS: Omit<R4ProfileRecord, 'uri' | 'cid' | 'createdAt' | 'updatedAt'> = {
	mode: 'auto',
	lightBackground: '0 0% 100%',
	lightForeground: '240 10% 3.9%',
	lightAccent: '262 83% 58%',
	darkBackground: '240 10% 3.9%',
	darkForeground: '0 0% 98%',
	darkAccent: '262 83% 58%'
}

export async function getR4Profile(did: string): Promise<R4ProfileRecord | null> {
	const channel = await getChannel(did).catch(() => null)
	if (!channel?.theme) return null
	return {
		...DEFAULTS,
		...channel.theme,
		createdAt: channel.createdAt,
		updatedAt: channel.updatedAt
	} as R4ProfileRecord
}

export async function setR4Profile(
	profile: Omit<R4ProfileRecord, 'uri' | 'cid' | 'createdAt' | 'updatedAt'>
) {
	const {
		mode,
		lightBackground,
		lightForeground,
		lightAccent,
		darkBackground,
		darkForeground,
		darkAccent
	} = profile
	return updateChannel({
		theme: {
			mode,
			lightBackground,
			lightForeground,
			lightAccent,
			darkBackground,
			darkForeground,
			darkAccent
		}
	})
}
