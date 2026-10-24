import {json} from '@sveltejs/kit'
import {dev} from '$app/env'
import {APP_ORIGIN, clientMetadata} from '#lib/oauth.js'

export const prerender = true

// In dev (e.g. behind an HTTPS tunnel) the metadata follows whatever origin serves it.
export const GET = ({url}) => json(clientMetadata(dev ? url.origin : APP_ORIGIN))
