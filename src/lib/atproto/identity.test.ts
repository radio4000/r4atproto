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
	/** A network serving `didDoc`, where its handle resolves to `handleDid` */
	function stubNetwork(handleDid: string, didDoc = doc) {
		const fetch = vi.fn(async (url: string | URL) =>
			String(url).includes('resolveHandle')
				? new Response(JSON.stringify({did: handleDid}))
				: new Response(JSON.stringify(didDoc))
		)
		vi.stubGlobal('fetch', fetch)
		return fetch
	}

	test('resolves did:web through .well-known, with a handle verified both ways', async () => {
		const fetch = stubNetwork('did:web:radio.test')
		await expect(resolveIdentity('did:web:radio.test')).resolves.toEqual({
			did: 'did:web:radio.test',
			handle: 'radio.test',
			pds: 'https://pds.radio.test'
		})
		expect(fetch).toHaveBeenCalledWith('https://radio.test/.well-known/did.json')
	})

	test('shows the DID, not a handle the document claims but does not own', async () => {
		const impostor = {...doc, id: 'did:web:impostor.test', alsoKnownAs: ['at://famous.test']}
		stubNetwork('did:plc:famous', impostor)
		const identity = await resolveIdentity('did:web:impostor.test')
		expect(identity.handle).toBe('did:web:impostor.test')
	})

	test('refuses a PDS endpoint that is not http(s)', () => {
		const bad = {...doc, service: [{...doc.service[0], serviceEndpoint: 'javascript:alert(1)'}]}
		expect(() => pdsFromDocument(bad)).toThrow()
	})
})
