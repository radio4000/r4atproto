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
				<legend>{m.settings_player_pause_new_decks()}</legend>
				<label>
					<input type="checkbox" bind:checked={appState.pause_new_decks} />
					{m.settings_player_pause_new_decks_description()}
				</label>
			</fieldset>

			<fieldset>
				<legend>{m.settings_player_new_deck_volume()}</legend>
				<label>
					<input
						type="checkbox"
						bind:checked={
							() => appState.default_new_deck_volume !== 0,
							(full) => (appState.default_new_deck_volume = full ? 1 : 0)
						}
					/>
					{m.settings_player_new_deck_volume_description()}
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

	label {
		display: flex;
		align-items: baseline;
		gap: var(--space-2);
	}
</style>
