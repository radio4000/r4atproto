<script>
	import {page} from '$app/state'
	import {appState} from '#lib/app-state.svelte.js'
	import {signIn, signOut} from '#lib/session.js'
	import {channelHref} from '#lib/links.js'
	import IconR4 from '#lib/components/icon-r4.svelte'
	import Seo from '#lib/components/seo.svelte'
	import * as m from '#lib/paraglide/messages.js'

	const redirect = $derived(page.url.searchParams.get('redirect') ?? undefined)
	let handle = $state('')
	let submitting = $state(false)
	let error = $state('')

	async function submit(event) {
		event.preventDefault()
		if (!handle.trim()) return
		submitting = true
		error = ''
		try {
			// Redirects to the account's PDS; the page unloads on success
			await signIn(handle, redirect)
		} catch (err) {
			error = m.auth_failed({message: err instanceof Error ? err.message : String(err)})
			submitting = false
		}
	}
</script>

<Seo title={m.auth_page_title()} />

<r4-page size="narrow" splash>
	<figure>
		<IconR4 size={64} />
	</figure>

	{#if appState.session}
		<p>{m.auth_signed_in_as_handle({handle: appState.session.handle})}</p>
		<menu>
			<li><a href={channelHref(appState.session.handle)}>{m.auth_go_to_radio()}</a></li>
			<li><a href="/settings">{m.settings_title()}</a></li>
			<li><button type="button" onclick={signOut}>{m.auth_log_out()}</button></li>
		</menu>
	{:else}
		<p>{m.auth_intro()}</p>
		<form onsubmit={submit}>
			<fieldset>
				<label for="auth-handle">{m.auth_handle_label()}</label>
				<!-- svelte-ignore a11y_autofocus -->
				<input
					id="auth-handle"
					type="text"
					autocomplete="username"
					autocapitalize="none"
					spellcheck="false"
					required
					autofocus
					placeholder={m.auth_handle_placeholder()}
					bind:value={handle}
				/>
			</fieldset>
			<button type="submit" disabled={submitting} aria-busy={submitting}>
				{submitting ? m.auth_submitting() : m.auth_submit()}
			</button>
		</form>
		{#if error}<p role="alert">{error}</p>{/if}
		<small>
			{m.auth_no_account()}
			<a href="https://bsky.app" target="_blank" rel="noopener noreferrer"
				>{m.auth_create_account()}</a
			>
		</small>
	{/if}
</r4-page>

<style>
	figure {
		margin: 0 auto var(--space-3);
	}

	menu {
		flex-direction: column;
		align-items: stretch;
	}
</style>
