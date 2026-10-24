<script>
	import {appState} from '#lib/app-state.svelte.js'
	import {setTheme} from '#lib/api.js'
	import {
		appearanceVariables as vars,
		fonts,
		resetAppearance,
		scale,
		setCssVariables
	} from '#lib/appearance.svelte.js'
	import SettingsHeader from '#lib/components/settings-header.svelte'
	import Seo from '#lib/components/seo.svelte'
	import * as m from '#lib/paraglide/messages.js'

	const themes = [
		{value: undefined, label: m.settings_theme_auto()},
		{value: 'light', label: m.settings_theme_light()},
		{value: 'dark', label: m.settings_theme_dark()}
	]
	const fontLabels = {
		default: m.theme_font_default(),
		system: m.theme_font_system(),
		serif: m.theme_font_serif(),
		mono: m.theme_font_mono()
	}

	const custom = $derived(appState.custom_css_variables ?? {})
	// The accent drives the whole accent scale (styles/color-scales.css)
	const accent = $derived(custom[vars.accentLight] ?? '')
	const scaling = $derived(Number(custom[vars.scaling]) || 1)
	const rounded = $derived(custom[vars.borderRadius] !== '0')

	const setAccent = (value) =>
		setCssVariables({[vars.accentLight]: value, [vars.accentDark]: value})
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
					{m.theme_scale_label()}
					<output>{scaling}</output>
					<input
						type="range"
						min={scale.min}
						max={scale.max}
						step={scale.step}
						value={scaling}
						oninput={(e) =>
							setCssVariables({
								[vars.scaling]: e.currentTarget.value === '1' ? '' : e.currentTarget.value
							})}
					/>
				</label>
			</fieldset>

			<fieldset>
				<label>
					{m.theme_font_label()}
					<select
						value={appState.font_family ?? 'default'}
						onchange={(e) => {
							const id = e.currentTarget.value
							appState.font_family = id === 'default' ? undefined : id
						}}
					>
						{#each fonts as font (font.id)}
							<option value={font.id} style:font-family={font.family || null}
								>{fontLabels[font.id]}</option
							>
						{/each}
					</select>
				</label>
			</fieldset>

			<fieldset>
				<label>
					<input
						type="checkbox"
						checked={rounded}
						onchange={(e) =>
							setCssVariables({[vars.borderRadius]: e.currentTarget.checked ? '' : '0'})}
					/>
					{m.theme_corners_label()}
				</label>
				<label>
					<input type="checkbox" bind:checked={appState.show_borders} />
					{m.theme_show_borders_label()}
				</label>
				<label>
					<input type="checkbox" bind:checked={appState.floating_ui} />
					{m.theme_floating_ui_label()}
				</label>
				<label>
					<input type="checkbox" bind:checked={appState.show_track_artwork} />
					{m.theme_show_artwork_label()}
				</label>
				<label>
					<input type="checkbox" bind:checked={appState.use_pointer_cursor} />
					{m.theme_pointer_cursor_label()}
				</label>
			</fieldset>

			<button type="button" onclick={resetAppearance}>{m.theme_reset_button()}</button>
		</form>
	</r4-box>
</r4-page>

<style>
	form {
		gap: var(--space-3);
	}

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

	/* Scale: label, value, then the slider on its own line */
	label:has(input[type='range']) {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: var(--space-1);

		input {
			grid-column: 1 / -1;
		}
	}

	label:has(select) {
		display: grid;
		gap: var(--space-1);
	}

	output {
		color: var(--gray-10);
		font-variant-numeric: tabular-nums;
	}

	label:has(input[type='checkbox']) {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}

	form > button {
		align-self: flex-start;
	}
</style>
