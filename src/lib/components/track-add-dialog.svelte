<script lang="ts">
	import {goto} from '$app/navigation'
	import {page} from '$app/state'
	import {authHref} from '#lib/links.js'
	import {appState} from '#lib/app-state.svelte.js'
	import Icon from '#lib/components/icon.svelte'
	import Dialog from '#lib/components/dialog.svelte'
	import TrackForm from '#lib/components/track-form.svelte'
	import TrackCard from '#lib/components/track-card.svelte'
	import {tracksCollection} from '#lib/collections/tracks.js'
	import {trackAddData} from '#lib/track-add.js'
	import * as m from '#lib/paraglide/messages.js'
	import type {Track} from '#lib/types.js'

	let {label = ''} = $props()

	const FORM_ID = 'track-add-form'

	let showModal = $state(false)
	let recentTracks = $state<Track[]>([])
	let trackData = $state({url: '', title: '', description: '', discogs_url: ''})
	let formSubmitting = $state(false)

	// Every account has a radio: its DID and handle are enough to add tracks
	const channel = $derived(
		appState.session ? {id: appState.session.did, slug: appState.session.handle} : undefined
	)
	const isSignedIn = $derived(!!appState.session)

	function open(data: {track?: Track; url?: string} = {}) {
		if (!isSignedIn || !channel) {
			goto(authHref(page.url.pathname))
			return
		}
		const track = data.track
		if (track) {
			trackData = trackAddData(track)
		} else {
			trackData = {url: data?.url || '', title: '', description: '', discogs_url: ''}
		}
		showModal = true
	}

	// Watch appState to open modal from anywhere
	$effect(() => {
		if (appState.modal_track_add) {
			open(appState.modal_track_add)
			appState.modal_track_add = null
		}
	})

	/** @param {KeyboardEvent} event */
	function handleKeyDown(event) {
		const target = /** @type {HTMLElement | null} */ event.target
		if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') return
		if (event.key === 'c' && !event.metaKey && !event.ctrlKey) {
			event.preventDefault()
			open()
		}
	}

	/** @param {{data: {url: string, title: string} | null, error: Error | null}} event */
	function handleSubmit(event) {
		const {data, error} = event
		if (error || !data) return

		const track = data.id ? tracksCollection.get(data.id) : null
		if (track) {
			recentTracks.unshift(track)
			if (recentTracks.length > 3) recentTracks.pop()
		}

		trackData = {url: '', title: '', description: '', discogs_url: ''}
		showModal = false
	}
</script>

<svelte:window onkeydown={handleKeyDown} />

<button
	type="button"
	aria-pressed={showModal}
	onclick={() => open()}
	aria-label={m.track_add_title()}
	title={m.track_add_title()}
>
	<Icon icon="add"></Icon>
	{#if label}<span>{label}</span>{/if}
</button>

<Dialog bind:showModal>
	{#snippet header()}
		<h2><a href="/add">{m.track_add_title()}</a></h2>
	{/snippet}

	{#if channel}
		<TrackForm
			mode="create"
			{channel}
			url={trackData.url}
			title={trackData.title}
			description={trackData.description}
			discogs_url={trackData.discogs_url}
			formId={FORM_ID}
			hideSubmit={true}
			bind:submitting={formSubmitting}
			onsubmit={handleSubmit}
		/>
	{/if}

	{#if recentTracks.length > 0}
		<section>
			<h3>{m.track_recently_saved()}</h3>
			{#each recentTracks as track (track.id)}
				<TrackCard {track} canEdit={false} showImage={false} />
			{/each}
		</section>
	{/if}

	{#snippet footer()}
		<button type="submit" form={FORM_ID} disabled={formSubmitting} aria-busy={formSubmitting}>
			{formSubmitting ? `${m.common_save()}…` : m.track_add_title()}
		</button>
	{/snippet}
</Dialog>

<style>
	section {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		margin-block-start: var(--space-3);
		padding-block-start: var(--space-3);
		border-block-start: 1px solid var(--color-interface-border);
	}

	h3 {
		font-size: var(--font-3);
		color: var(--gray-10);
	}
</style>
