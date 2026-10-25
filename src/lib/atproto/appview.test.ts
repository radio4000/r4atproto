import {expect, test, vi} from 'vitest'

vi.mock('../config/app.json', async (original) => {
	const app = ((await original()) as {default: Record<string, unknown>}).default
	return {default: {...app, indexer: {...(app.indexer as object), enabled: true, retrySeconds: 60}}}
})

const {fromIndex, indexAvailable} = await import('./appview')

test('a failing index falls back to direct reads, and is left alone for a while', async () => {
	vi.spyOn(console, 'warn').mockImplementation(() => {})
	expect(await fromIndex(async () => 'index', async () => 'direct')).toBe('index')
	const failing = vi.fn(async () => Promise.reject(new Error('down')))
	expect(await fromIndex(failing, async () => 'direct')).toBe('direct')
	expect(indexAvailable()).toBe(false)
	expect(await fromIndex(failing, async () => 'direct')).toBe('direct')
	expect(failing).toHaveBeenCalledTimes(1)
})
