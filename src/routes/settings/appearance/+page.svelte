<script>
	import {appState} from '#lib/app-state.svelte.js'
	import {setTheme} from '#lib/api.js'
	import SettingsHeader from '#lib/components/settings-header.svelte'
	import Seo from '#lib/components/seo.svelte'
	import * as m from '#lib/paraglide/messages.js'

	const themes = [
		{value: undefined, label: m.settings_theme_auto()},
		{value: 'light', label: m.settings_theme_light()},
		{value: 'dark', label: m.settings_theme_dark()}
	]

	// The accent drives the whole accent scale (styles/color-scales.css)
	const accent = $derived(appState.custom_css_variables['--accent-light'] ?? '')

	function setAccent(value) {
		const vars = {...appState.custom_css_variables}
		if (value) {
			vars['--accent-light'] = value
			vars['--accent-dark'] = value
		} else {
			delete vars['--accent-light']
			delete vars['--accent-dark']
		}
		appState.custom_css_variables = vars
	}
</script>

<Seo title={m.settings_appearance()} />

<r4-page size="narrow">
	<SettingsHeader title={m.settings_appearance()} />
	<r4-box>
		<form>
			<fieldset>
				<legend>{m.theme_theme_label()}</legend>
				<menu>
					{#each themes as theme (theme.label)}
						<li>
							<button
								type="button"
								aria-pressed={appState.theme === theme.value}
								onclick={() => setTheme(theme.value)}
							>
								{theme.label}
							</button>
						</li>
					{/each}
				</menu>
			</fieldset>
			<fieldset>
				<legend>{m.settings_accent()}</legend>
				<r4-accent-field>
					<input
						type="color"
						value={accent || '#7c3aed'}
						oninput={(e) => setAccent(e.currentTarget.value)}
					/>
					<button type="button" onclick={() => setAccent('')} disabled={!accent}
						>{m.settings_accent_reset()}</button
					>
				</r4-accent-field>
			</fieldset>
			<fieldset>
				<label>
					<input type="checkbox" bind:checked={appState.show_track_artwork} />
					{m.theme_show_artwork_label()}
				</label>
			</fieldset>
		</form>
	</r4-box>
</r4-page>

<style>
	r4-accent-field {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}

	input[type='color'] {
		width: var(--control-size);
		height: var(--control-size);
		padding: 0;
		border: none;
		background: none;
	}
</style>
