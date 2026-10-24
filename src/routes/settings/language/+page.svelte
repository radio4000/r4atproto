<script>
	import {appState} from '#lib/app-state.svelte.js'
	import {getLocale, locales, setLocale} from '#lib/paraglide/runtime.js'
	import SettingsHeader from '#lib/components/settings-header.svelte'
	import Seo from '#lib/components/seo.svelte'
	import * as m from '#lib/paraglide/messages.js'

	const current = getLocale()
	// Each language named in itself
	const name = (locale) => new Intl.DisplayNames([locale], {type: 'language'}).of(locale) ?? locale

	function choose(locale) {
		appState.language = locale
		setLocale(locale)
	}
</script>

<Seo title={m.settings_language()} />

<r4-page size="narrow">
	<SettingsHeader title={m.settings_language()} />
	<menu>
		{#each locales as locale (locale)}
			<li>
				<button
					type="button"
					lang={locale}
					aria-pressed={locale === current}
					onclick={() => choose(locale)}
				>
					{name(locale)}
				</button>
			</li>
		{/each}
	</menu>
</r4-page>

<style>
	menu {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(9rem, 1fr));
	}

	li {
		display: grid;
	}

	button {
		justify-content: flex-start;
		text-transform: capitalize;
	}
</style>
