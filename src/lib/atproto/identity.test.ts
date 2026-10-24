import {afterEach, describe, expect, test, vi} from 'vitest'
import {handleFromDocument, pdsFromDocument, resolveIdentity} from './identity'

const doc = {
	id: 'did:web:radio.test',
	alsoKnownAs: ['at://radio.test'],
	service: [
		{
			id: '#atproto_pds',
			type: 'AtprotoPersonalDataServer',
			serviceEndpoint: 'https://pds.radio.test'
		}
	]
}

afterEach(() => vi.unstubAllGlobals())

describe('DID documents', () => {
	test('give the PDS and the handle', () => {
		expect(pdsFromDocument(doc)).toBe('https://pds.radio.test')
		expect(handleFromDocument(doc)).toBe('radio.test')
	})
})

describe('resolveIdentity', () => {
	test('resolves did:web through .well-known', async () => {
		const fetch = vi.fn(async () => new Response(JSON.stringify(doc)))
		vi.stubGlobal('fetch', fetch)
		await expect(resolveIdentity('did:web:radio.test')).resolves.toEqual({
			did: 'did:web:radio.test',
			handle: 'radio.test',
			pds: 'https://pds.radio.test'
		})
		expect(fetch).toHaveBeenCalledWith('https://radio.test/.well-known/did.json')
	})
})
