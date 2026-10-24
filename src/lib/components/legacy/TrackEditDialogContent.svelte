<script lang="ts">
	import {TRACK} from '#lib/lexicons.js'
	import {onMount} from 'svelte'
	import {resolveHandle, getTrackByUri} from '#lib/services/r4-service.js'
	import TrackEditForm from '#lib/components/legacy/TrackEditForm.svelte'

	let {handle = '', repo = '', rkey = '', track = null, onsaved = () => {}} = $props()

	const sanitizedHandle = $derived(handle ? handle.replace(/^@/, '') : '')
	const resolvedRepo = $derived(repo || '')
	const rkeyValue = $derived(rkey || '')
	let initial = $state({
		url: track?.url || '',
		title: track?.title || '',
		description: track?.description || '',
		discogs_url: track?.discogs_url || ''
	})
	let uri = $state(track?.uri || '')
	let seeded = $state(Boolean(track))

	function seedFrom(data: any, fallbackUri?: string) {
		if (!data) return
		initial = {
			url: data.url || '',
			title: data.title || '',
			description: data.description || '',
			discogs_url: data.discogs_url || ''
		}
		uri = data.uri || fallbackUri || uri
		seeded = true
	}

	$effect(() => {
		if (!seeded && track) {
			seedFrom(track)
		}
	})

	onMount(() => {
		;(async () => {
			if (seeded) return
			let didOrRepo = resolvedRepo
			if (!didOrRepo && sanitizedHandle) {
				try {
					didOrRepo = (await resolveHandle(sanitizedHandle)) || ''
				} catch {
					didOrRepo = ''
				}
			}
			if (didOrRepo && rkeyValue) {
				const nextUri = `at://${didOrRepo}/${TRACK}/${rkeyValue}`
				uri = nextUri
				try {
					const rec = await getTrackByUri(nextUri)
					seedFrom({...rec, uri: nextUri})
				} catch {
					// ignore fetch failures; form remains blank
				}
			}
		})()
	})
</script>

<TrackEditForm {initial} {uri} {onsaved} />
