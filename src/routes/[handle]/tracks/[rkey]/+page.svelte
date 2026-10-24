<script lang="ts">
	import {TRACK} from '#lib/lexicons.js'
	import {getTrackByUri, resolveHandle, listTracksByDid} from '#lib/services/r4-service.js'
	import TrackDetail from '#lib/components/TrackDetail.svelte'
	import {session} from '#lib/state/session.js'
	import {Loader2, AlertCircle} from 'lucide-svelte'
	import StateCard from '#lib/components/ui/state-card.svelte'
	import {Button} from '#lib/components/ui/button/index.js'
	import {locale, translate} from '#lib/i18n/index.js'
	import {browser} from '$app/environment'
	import SeoHead from '#lib/components/SeoHead.svelte'

	let {data} = $props()
	const _handle = $derived(data?.handle || '')
	const handle = $derived(_handle ? _handle.replace(/^@/, '') : '')
	const rkey = $derived(data?.rkey || '')

	let item = $state(null)
	let did = $state('')
	let allTracks = $state([])
	let status = $state('')
	let loading = $state(false)
	let displayHandle = $state('')
	const context = $derived({type: 'author', key: did, handle: displayHandle || undefined})
	const editable = $derived($session?.did && did && $session.did === did ? true : false)
	const discogsUrl = $derived(item?.discogs_url || '')
	let loadRequestId = 0
	let currentKey = $state('')
	const t = (key, vars = {}) => translate($locale, key, vars)
	const trackIndex = $derived(item ? allTracks.findIndex((t) => t.uri === item.uri) : 0)
	const trackTitle = $derived(
		item
			? `${item.title || t('trackItem.untitled')} — @${displayHandle || handle}`
			: t('trackDetail.loadingTitle')
	)
	const trackDescription = $derived(item?.description || t('trackDetail.loadingDescription'))

	function refreshTrack() {
		loadTrack(handle, rkey)
	}

	function tryHydrateFromState() {
		if (!browser) return false

		const nav = window.history.state || {}
		const navTrack = nav.track || null
		const navTracks = nav.tracks || []
		const navDid = nav.did || ''
		const navHandle = nav.handle || ''

		// Only hydrate if we have the track data
		if (!navTrack) return false

		console.log('[Track Detail] Hydrating from navigation state')

		item = navTrack
		// Use the full track list from navigation if available, otherwise just the single track
		allTracks = navTracks.length > 0 ? navTracks : [navTrack]

		if (navDid) {
			did = navDid
		}
		if (navHandle) {
			displayHandle = navHandle
		}

		return true
	}

	async function loadTrack(currentHandle: string, currentRkey: string) {
		const requestId = ++loadRequestId
		loading = true
		status = ''

		console.log('[Track Detail] Loading track data from API', {
			handle: currentHandle,
			rkey: currentRkey
		})

		try {
			if (!currentHandle || !currentRkey) {
				if (requestId === loadRequestId) status = t('trackDetail.errorTitle')
				return
			}

			const resolvedDid = await resolveHandle(currentHandle)
			if (requestId !== loadRequestId) return
			did = resolvedDid
			displayHandle = currentHandle

			// Load both the specific track and all profile tracks in parallel
			const [trackData, profileTracks] = await Promise.all([
				getTrackByUri(`at://${resolvedDid}/${TRACK}/${currentRkey}`),
				listTracksByDid(resolvedDid)
			])

			if (requestId === loadRequestId) {
				item = {...trackData}
				// Use all profile tracks so play works in full context
				allTracks = profileTracks.tracks || [trackData]
			}
		} catch (e) {
			if (requestId === loadRequestId) status = (e as Error)?.message || t('trackDetail.errorTitle')
		} finally {
			if (requestId === loadRequestId) loading = false
		}
	}

	$effect(() => {
		if (!handle || !rkey) return
		const key = `${handle}:${rkey}`
		if (key === currentKey) return
		currentKey = key

		// Try to hydrate from navigation state first
		const hydrated = tryHydrateFromState()

		// Only load from API if hydration failed
		if (!hydrated) {
			loadTrack(handle, rkey)
		}
	})
</script>

<SeoHead title={trackTitle} description={trackDescription} />

<div class="max-w-4xl mx-auto px-4 py-6">
	{#if loading}
		<div class="flex items-center justify-center min-h-[50vh]">
			<StateCard
				icon={Loader2}
				loading={true}
				title={t('trackDetail.loadingTitle')}
				description={t('trackDetail.loadingDescription')}
			/>
		</div>
	{:else if status}
		<div class="flex items-center justify-center min-h-[50vh]">
			<StateCard icon={AlertCircle} title={t('trackDetail.errorTitle')} description={status}>
				{#snippet actions()}
					<Button variant="outline" onclick={refreshTrack}>
						{t('buttons.tryAgain')}
					</Button>
				{/snippet}
			</StateCard>
		</div>
	{:else if item}
		<TrackDetail
			track={item}
			{handle}
			items={allTracks}
			index={trackIndex >= 0 ? trackIndex : 0}
			{context}
			{editable}
		/>
	{/if}
</div>
