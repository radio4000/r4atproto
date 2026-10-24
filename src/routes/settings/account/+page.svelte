<script>
	import {appState} from '#lib/app-state.svelte.js'
	import {bskyOAuth} from '#lib/services/bsky-oauth.js'
	import {resolvePds} from '#lib/atproto/identity.js'
	import {signOut} from '#lib/session.js'
	import {channelHref} from '#lib/links.js'
	import SettingsHeader from '#lib/components/settings-header.svelte'
	import Seo from '#lib/components/seo.svelte'
	import * as m from '#lib/paraglide/messages.js'

	let pds = $state('')
	$effect(() => {
		const did = appState.session?.did
		if (did) resolvePds(did).then((url) => (pds = new URL(url).host))
	})
</script>

<Seo title={m.settings_account()} />

<r4-page size="narrow">
	<SettingsHeader title={m.settings_account()} />
	{#if appState.session}
		<r4-box>
			<dl>
				<dt>{m.auth_handle_label()}</dt>
				<dd><a href={channelHref(appState.session.handle)}>@{appState.session.handle}</a></dd>
				<dt>{m.settings_account_did()}</dt>
				<dd><code>{appState.session.did}</code></dd>
				{#if pds}
					<dt>{m.settings_account_pds()}</dt>
					<dd>{pds}</dd>
				{/if}
			</dl>
		</r4-box>
		<r4-box>
			<p><small>{m.settings_account_permissions_hint()}</small></p>
			<menu>
				<li>
					<button type="button" onclick={() => bskyOAuth.requestScopes()}
						>{m.settings_account_permissions()}</button
					>
				</li>
				<li><button type="button" onclick={signOut}>{m.auth_log_out()}</button></li>
			</menu>
		</r4-box>
	{:else}
		<r4-empty
			><p><a href="/auth?redirect=/settings/account">{m.settings_signed_out()}</a></p></r4-empty
		>
	{/if}
</r4-page>

<style>
	dd {
		overflow-wrap: anywhere;
	}
</style>
