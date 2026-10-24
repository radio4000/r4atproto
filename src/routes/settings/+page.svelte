<script>
	import {appState} from '#lib/app-state.svelte.js'
	import Icon from '#lib/components/icon.svelte'
	import Seo from '#lib/components/seo.svelte'
	import * as m from '#lib/paraglide/messages.js'

	const sections = $derived([
		...(appState.session
			? [
					{href: '/settings/radio', icon: 'radio', label: m.settings_radio()},
					{href: '/settings/import', icon: 'document-download', label: m.settings_import()}
				]
			: []),
		{href: '/settings/appearance', icon: 'palette', label: m.settings_appearance()},
		{href: '/settings/player', icon: 'tv', label: m.settings_player()},
		{href: '/settings/language', icon: 'globe', label: m.settings_language()},
		{
			href: appState.session ? '/settings/account' : '/auth',
			icon: 'user',
			label: appState.session ? m.settings_account() : m.nav_sign_in()
		}
	])
</script>

<Seo title={m.settings_title()} />

<r4-page size="narrow">
	<r4-page-header><h1>{m.settings_title()}</h1></r4-page-header>
	<nav>
		<menu>
			{#each sections as section (section.href)}
				<li>
					<a href={section.href}><Icon icon={section.icon} />{section.label}</a>
				</li>
			{/each}
		</menu>
	</nav>
</r4-page>

<style>
	menu {
		flex-direction: column;
		align-items: stretch;

		li {
			display: grid;
		}

		a {
			justify-content: flex-start;
		}
	}
</style>
