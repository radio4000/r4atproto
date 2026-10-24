/**
 * Handle ⇄ DID ⇄ PDS resolution, cached for the session. Supports did:plc and did:web.
 */
import app from '../config/app.json' with {type: 'json'}
import {pooledFetch} from './pool'
import {xrpcGet} from './xrpc'
import {safeUrl} from './validate'

export interface Identity {
	did: string
	handle: string
	pds: string
}

interface DidDocument {
	id: string
	alsoKnownAs?: string[]
	service?: {id: string; type: string; serviceEndpoint: string}[]
}

const didDocs = new Map<string, Promise<DidDocument>>()
const handles = new Map<string, Promise<string>>()

export const isDid = (value: string) => value.startsWith('did:')

/** Strip a leading @ and lowercase */
export const normalizeHandle = (handle: string) => handle.replace(/^@/, '').toLowerCase()

function fetchDidDocument(did: string): Promise<DidDocument> {
	let url: string
	if (did.startsWith('did:plc:')) url = `${app.services.plcDirectory}/${did}`
	else if (did.startsWith('did:web:'))
		url = `https://${did.slice('did:web:'.length)}/.well-known/did.json`
	else return Promise.reject(new Error(`Unsupported DID method: ${did}`))
	return pooledFetch(url).then((res) => {
		if (!res.ok) throw new Error(`Could not resolve ${did} (${res.status})`)
		return res.json()
	})
}

function didDocument(did: string): Promise<DidDocument> {
	let doc = didDocs.get(did)
	if (!doc) {
		doc = fetchDidDocument(did)
		doc.catch(() => didDocs.delete(did))
		didDocs.set(did, doc)
	}
	return doc
}

export function pdsFromDocument(doc: DidDocument): string {
	const service = doc.service?.find((s) => s.id.endsWith('#atproto_pds'))
	const endpoint = safeUrl(service?.serviceEndpoint)
	if (!endpoint) throw new Error(`No PDS for ${doc.id}`)
	return endpoint
}

export function handleFromDocument(doc: DidDocument): string | undefined {
	return doc.alsoKnownAs?.find((aka) => aka.startsWith('at://'))?.slice('at://'.length)
}

export async function resolveHandle(handle: string): Promise<string> {
	const key = normalizeHandle(handle)
	let did = handles.get(key)
	if (!did) {
		did = xrpcGet<{did: string}>(app.services.appview, 'com.atproto.identity.resolveHandle', {
			handle: key
		}).then((res) => res.did)
		did.catch(() => handles.delete(key))
		handles.set(key, did)
	}
	return did
}

export async function resolvePds(did: string): Promise<string> {
	return pdsFromDocument(await didDocument(did))
}

/**
 * Resolve a handle or a DID to its DID, handle and PDS. A handle counts only when it
 * goes both ways: the DID document claims it and it resolves back to that DID.
 * Anyone can claim any handle in their DID document, so an unverified one is
 * replaced by the DID, never shown.
 */
export async function resolveIdentity(handleOrDid: string): Promise<Identity> {
	const did = isDid(handleOrDid) ? handleOrDid : await resolveHandle(handleOrDid)
	const doc = await didDocument(did)
	const claimed = handleFromDocument(doc)
	const verified = claimed && (await resolveHandle(claimed).catch(() => null)) === did
	return {did, handle: verified ? normalizeHandle(claimed) : did, pds: pdsFromDocument(doc)}
}
