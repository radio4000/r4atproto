<script>
	import {appState} from '#lib/app-state.svelte.js'
	import Dialog from '#lib/components/dialog.svelte'
	import TrackForm from '#lib/components/track-form.svelte'
	import * as m from '#lib/paraglide/messages.js'

	let showModal = $state(false)

	let track = $state(/** @type {import('#lib/types.js').Track | null} */ (null))

	// A track belongs to the account that holds it
	const channel = $derived(track ? {id: track.did, slug: track.slug} : null)

	/** @param {{track: import('#lib/types.js').Track}} data */
	function open(data) {
		track = data.track
		showModal = true
	}

	$effect(() => {
		if (appState.modal_track_edit) {
			open(appState.modal_track_edit)
			appState.modal_track_edit = null
		}
	})

	function handleSubmit(event) {
		if (event.error) return
		showModal = false
	}
</script>

<Dialog bind:showModal>
	{#snippet header()}
		<h2>{m.track_edit_title()}</h2>
	{/snippet}

	{#if showModal && track && channel}
		<TrackForm
			mode="edit"
			channel={{id: channel.id, slug: channel.slug}}
			trackId={track.id}
			url={track.url}
			title={track.title}
			description={track.description ?? undefined}
			discogs_url={track.discogs_url ?? undefined}
			onsubmit={handleSubmit}
		/>
	{/if}
</Dialog>
