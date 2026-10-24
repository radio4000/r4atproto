<script lang="ts">
	import {updateTrackByUri} from '#lib/services/r4-service.js'
	import TrackForm from './TrackForm.svelte'
	const props = $props()
	const uri = $derived(props.uri || '')
	const initial = $derived(props.initial || {url: '', title: '', description: '', discogs_url: ''})
	const onsaved = $derived(props.onsaved || (() => {}))

	async function onSave({url, title, description, discogs_url}) {
		await updateTrackByUri(uri, {url, title, description, discogs_url: discogs_url || undefined})
		const ev = new CustomEvent('saved', {detail: {uri}})
		dispatchEvent(ev)
		onsaved({uri})
	}
</script>

<TrackForm {initial} submitLabel="Save" onSubmit={onSave} />
