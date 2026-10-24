<script>
	import {appState} from '#lib/app-state.svelte.js'
	import SettingsHeader from '#lib/components/settings-header.svelte'
	import Seo from '#lib/components/seo.svelte'
	import * as m from '#lib/paraglide/messages.js'
</script>

<Seo title={m.settings_player()} />

<r4-page size="narrow">
	<SettingsHeader title={m.settings_player()} />

	<r4-box>
		<form>
			<fieldset>
				<legend>{m.settings_player_new_deck_volume()}</legend>
				<label>
					<input type="radio" bind:group={appState.default_new_deck_volume} value={0} />
					{m.settings_player_volume_silent()}
				</label>
				<label>
					<input type="radio" bind:group={appState.default_new_deck_volume} value={1} />
					{m.settings_player_volume_full()}
				</label>
			</fieldset>

			<fieldset>
				<legend>{m.settings_player_autoplay()}</legend>
				<label>
					<input type="checkbox" bind:checked={appState.autoplay_new_deck} />
					{m.settings_player_autoplay_description()}
				</label>
			</fieldset>

			<fieldset>
				<legend>{m.settings_player_speed_control()}</legend>
				<label>
					<input type="checkbox" bind:checked={appState.show_speed_control} />
					{m.settings_player_speed_control_description()}
				</label>
			</fieldset>

			<fieldset>
				<legend>{m.settings_player_track_range()}</legend>
				<label>
					<input type="checkbox" bind:checked={appState.show_track_range_control} />
					{m.settings_player_track_range_description()}
				</label>
			</fieldset>
		</form>
	</r4-box>
</r4-page>

<style>
	form {
		gap: var(--space-3);
	}

	legend {
		font-size: var(--font-5);
	}
</style>
