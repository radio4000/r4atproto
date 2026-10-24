// NSIDs of our lexicons, derived from the namespace in config/app.json.
// The schemas live in /lexicons/<namespace as path>/*.json.
import app from './config/app.json' with {type: 'json'}

export const NAMESPACE = app.namespace
export const TRACK = `${NAMESPACE}.track`
export const CHANNEL = `${NAMESPACE}.channel`
export const FOLLOW = `${NAMESPACE}.follow`
export const BROADCAST = `${NAMESPACE}.broadcast`
/** The permission set the app asks for at sign-in */
export const AUTH = `${NAMESPACE}.${app.oauth.permissionSet}`

/** rkey of singleton records (channel, broadcast) */
export const SELF = 'self'
