/**
 * Presence (who is listening right now) needs a realtime server, which this app
 * doesn't have. Same exports as r4-svelte's module so components port over; counts stay at zero.
 */
export const appPresence = $state({count: 0})

/** @type {Record<string, {broadcast?: number, auto?: number, byUri?: Record<string, number>}>} */
export const channelPresence = $state({})

export function trackAppPresence() {}
export async function untrackAppPresence() {}
/** @param {string} _slug */
export function trackBroadcastPresence(_slug) {}
/** @param {string} _slug @param {unknown} [_view] */
export function trackAutoRadioPresence(_slug, _view) {}
/** @param {string} _slug */
export async function untrackBroadcastPresence(_slug) {}
/** @param {string} _slug */
export async function untrackAutoRadioPresence(_slug) {}
/** @param {string} _slug */
export function watchPresence(_slug) {}
/** @param {string} _slug */
export function unwatchPresence(_slug) {}
