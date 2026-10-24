<script>
	import {goto} from '$app/navigation'
	import {page} from '$app/state'
	import {appState} from '#lib/app-state.svelte.js'
	import {authHref, channelHref} from '#lib/links.js'
	import TrackForm from '#lib/components/track-form.svelte'
	import Seo from '#lib/components/seo.svelte'
	import * as m from '#lib/paraglide/messages.js'

	// Prefill from ?url=&title=&description=&discogs_url= (bookmarklets, "add to my radio")
	const params = $derived(page.url.searchParams)
	const rawUrl = $derived(params.get('url') || '')
	const isDiscogsUrl = $derived.by(() => {
		try {
			return new URL(rawUrl).hostname.includes('discogs.com')
		} catch {
			return false
		}
	})
	const channel = $derived(
		appState.session ? {id: appState.session.did, slug: appState.session.handle} : undefined
	)

	function handleSubmit({data, error}) {
		if (error || !data || !channel) return
		goto(channelHref(channel.slug))
	}
</script>

<Seo title={m.page_title_add_track()} />

<r4-page>
	{#if channel}
		<r4-page-header>
			<h1>{m.track_add_title()} <a href={channelHref(channel.slug)}>@{channel.slug}</a></h1>
		</r4-page-header>
		<TrackForm
			mode="create"
			{channel}
			url={isDiscogsUrl ? '' : rawUrl}
			title={params.get('title') || ''}
			description={params.get('description') || ''}
			discogs_url={params.get('discogs_url') || (isDiscogsUrl ? rawUrl : '')}
			onsubmit={handleSubmit}
		/>
	{:else}
		<r4-empty>
			<p><a href={authHref(page.url.pathname + page.url.search)}>{m.auth_sign_in_to_add()}</a></p>
		</r4-empty>
	{/if}
</r4-page>
