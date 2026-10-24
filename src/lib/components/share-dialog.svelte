<script lang="ts">
	import {appState} from '#lib/app-state.svelte.js'
	import Dialog from '#lib/components/dialog.svelte'
	import Icon from '#lib/components/icon.svelte'
	import {channelUrl, trackUrl, copyToClipboard, canNativeShare, nativeShare} from '#lib/share.js'
	import type {Track, Channel} from '#lib/types.js'
	import * as m from '#lib/paraglide/messages.js'

	let showModal = $state(false)
	let copiedField = $state<string | null>(null)
	let data = $state<{track?: Track; channel: Channel} | null>(null)

	const isTrack = $derived(!!data?.track)
	const title = $derived(
		isTrack
			? m.share_track_title({title: data?.track?.title ?? ''})
			: m.share_channel_title({name: data?.channel?.name ?? ''})
	)
	const url = $derived(data ? (data.track ? trackUrl(data.track) : channelUrl(data.channel)) : '')
	const mediaUrl = $derived(data?.track?.url ?? '')

	$effect(() => {
		if (appState.modal_share) {
			data = appState.modal_share
			copiedField = null
			showModal = true
			appState.modal_share = null
		}
	})

	async function copy(text: string, field: string) {
		if (await copyToClipboard(text)) {
			copiedField = field
			setTimeout(() => (copiedField = null), 1500)
		}
	}

	async function share() {
		if (!data) return
		const {track, channel} = data
		await nativeShare(
			track
				? {title: track.title, text: `@${channel.slug}`, url}
				: {title: channel.name ?? '', text: channel.description?.slice(0, 100) ?? '', url}
		)
	}

	function selectAll(e: FocusEvent) {
		;(e.target as HTMLInputElement).select()
	}
</script>

<Dialog bind:showModal>
	{#snippet header()}
		<h2>{title}</h2>
	{/snippet}

	<form>
		<fieldset>
			<label for="share-url">{m.common_url()}</label>
			<r4-share-field>
				<input id="share-url" type="text" readonly value={url} onfocus={selectAll} />
				<button type="button" onclick={() => copy(url, 'url')}>
					{copiedField === 'url' ? m.share_copied() : m.share_copy()}
				</button>
			</r4-share-field>
		</fieldset>

		{#if isTrack && mediaUrl}
			<fieldset>
				<label for="share-media">{m.share_media_url_label()}</label>
				<r4-share-field>
					<input id="share-media" type="text" readonly value={mediaUrl} onfocus={selectAll} />
					<button type="button" onclick={() => copy(mediaUrl, 'media')}>
						{copiedField === 'media' ? m.share_copied() : m.share_copy()}
					</button>
				</r4-share-field>
			</fieldset>
		{/if}

		{#if canNativeShare()}
			<button type="button" onclick={share}>
				<Icon icon="share" />
				{m.channel_card_share()}
			</button>
		{/if}
	</form>
</Dialog>

<style>
	r4-share-field {
		display: flex;
		gap: var(--space-1);
	}

	input {
		flex: 1;
		min-width: 0;
	}
</style>
