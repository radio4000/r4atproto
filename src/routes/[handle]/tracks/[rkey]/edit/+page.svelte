<script lang="ts">
	import TrackEditDialogContent from '#lib/components/TrackEditDialogContent.svelte'
	import {Dialog} from '#lib/components/ui/dialog/index.js'
	import {goto} from '$app/navigation'
	import {resolve} from '$app/paths'
	import {session} from '#lib/state/session.js'
	import {locale, translate} from '#lib/i18n/index.js'
	import {onMount} from 'svelte'

	let {data, handle = '', rkey = '', repo = ''} = $props()
	const normalizedHandle = $derived(handle ? handle.replace(/^@/, '') : '')
	const t = (key, vars = {}) => translate($locale, key, vars)
	let returnTo = $state('')
	let trackData = $state(data?.track || null)

	onMount(() => {
		const navState = window.history.state || {}
		returnTo = navState?.returnTo || ''
		if (navState?.track) {
			trackData = navState.track
		}
	})

	function close() {
		const userHandle = normalizedHandle || $session?.handle || ''
		const fallback = userHandle ? `/@${encodeURIComponent(userHandle)}` : '/'
		const target = returnTo || fallback
		goto(resolve(target), {replaceState: true, noScroll: true, keepFocus: true}).catch(() => {
			window.history.back()
		})
	}
</script>

<Dialog title={t('editTrack.title')} onClose={close}>
	<TrackEditDialogContent {handle} {repo} {rkey} track={trackData} />
</Dialog>
