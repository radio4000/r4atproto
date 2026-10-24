import type {Channel, Track} from '#lib/types.js'
import app from '#lib/config/app.json' with {type: 'json'}
import {channelHref, trackHref} from '#lib/links.js'

const origin = globalThis.location?.origin ?? `https://${app.domain}`

export const channelUrl = (channel: Pick<Channel, 'slug'>) =>
	`${origin}${channelHref(channel.slug)}`

export const trackUrl = (track: Pick<Track, 'id' | 'slug'>) => `${origin}${trackHref(track)}`

export const copyToClipboard = (text: string) =>
	navigator.clipboard.writeText(text).then(
		() => true,
		() => false
	)

export const canNativeShare = () => typeof navigator !== 'undefined' && !!navigator.share

type ShareData = {title: string; text?: string; url: string}

/* Firefox Android never settles a dismissed share, and allows one share per navigator
   ("Only one share picker at a time per navigator instance", InvalidStateError), so every
   later share() on the page fails. A same-origin iframe has its own navigator and, when it
   exists at tap time, gets the tap's user activation. While a share is pending we keep one
   spare iframe ready and share through it when the page's navigator is stuck. */
let spareFrame: HTMLIFrameElement | undefined
let usedFrame: HTMLIFrameElement | undefined

function addSpareFrame() {
	if (spareFrame?.isConnected) return
	spareFrame = document.createElement('iframe')
	spareFrame.hidden = true
	document.body.append(spareFrame)
}

function removeFrames() {
	spareFrame?.remove()
	usedFrame?.remove()
	spareFrame = usedFrame = undefined
}

/** Share through the spare iframe and get the next spare ready. */
function shareViaSpare(data: ShareData) {
	const frame = spareFrame
	const frameNavigator = frame?.contentWindow?.navigator
	if (!frame || !frameNavigator?.share)
		return Promise.reject(new DOMException('', 'InvalidStateError'))
	usedFrame?.remove()
	usedFrame = frame
	spareFrame = undefined
	addSpareFrame()
	return frameNavigator.share(data)
}

const isError = (error: unknown, name: string) =>
	error instanceof DOMException && error.name === name

/** Opens the native share sheet; false when unavailable, cancelled or refused. */
export async function nativeShare(data: ShareData) {
	if (!canNativeShare()) return false
	addSpareFrame()
	// new Promise also catches a synchronous throw (TypeError on bad data).
	const share = new Promise((resolve) => resolve(navigator.share(data))).catch((error) => {
		if (isError(error, 'InvalidStateError')) return shareViaSpare(data)
		throw error
	})
	try {
		await share
		// Settled: this browser reports dismissals, no spare needed.
		removeFrames()
		return true
	} catch (error) {
		if (isError(error, 'AbortError')) removeFrames()
		return false
	}
}
