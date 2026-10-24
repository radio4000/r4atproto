<script>
	import {appState} from '#lib/app-state.svelte.js'
	import {updateChannel} from '#lib/collections/channels.js'
	import {channelHref} from '#lib/links.js'
	import ChannelAvatar from '#lib/components/channel-avatar.svelte'
	import SettingsHeader from '#lib/components/settings-header.svelte'
	import Seo from '#lib/components/seo.svelte'
	import MapPicker from '#lib/components/map-picker.svelte'
	import * as m from '#lib/paraglide/messages.js'

	const channel = $derived(appState.channel)

	let name = $state('')
	let description = $state('')
	let url = $state('')
	let latitude = $state('')
	let longitude = $state('')
	let image = $state(/** @type {File | undefined} */ (undefined))
	let preview = $state(/** @type {string | undefined} */ (undefined))
	let showMap = $state(false)
	let saving = $state(false)
	let saved = $state(false)
	let error = $state('')

	// Fill the form once the channel is known
	let filledFor = ''
	$effect(() => {
		if (!channel || filledFor === channel.id) return
		filledFor = channel.id
		name = channel.has_record ? channel.name : ''
		description = channel.has_record ? (channel.description ?? '') : ''
		url = channel.url ?? ''
		latitude = channel.latitude?.toString() ?? ''
		longitude = channel.longitude?.toString() ?? ''
	})

	function pickImage(event) {
		image = event.currentTarget.files?.[0]
		if (preview) URL.revokeObjectURL(preview)
		preview = image ? URL.createObjectURL(image) : undefined
	}

	async function save(event) {
		event.preventDefault()
		saving = true
		saved = false
		error = ''
		try {
			const lat = Number.parseFloat(latitude)
			const lng = Number.parseFloat(longitude)
			const hasGeo = Number.isFinite(lat) && Number.isFinite(lng)
			appState.channel = await updateChannel(
				{
					name: name.trim() || undefined,
					description: description.trim() || undefined,
					url: url.trim() || undefined,
					latitude: hasGeo ? lat : null,
					longitude: hasGeo ? lng : null
				},
				image
			)
			image = undefined
			saved = true
		} catch (err) {
			error = err instanceof Error ? err.message : String(err)
		} finally {
			saving = false
		}
	}
</script>

<Seo title={m.settings_radio()} />

<r4-page size="narrow">
	<SettingsHeader title={m.settings_radio()} />
	{#if !appState.session}
		<r4-empty
			><p><a href="/auth?redirect=/settings/radio">{m.settings_signed_out()}</a></p></r4-empty
		>
	{:else}
		<p>{m.settings_radio_intro()}</p>
		<form onsubmit={save}>
			<fieldset>
				<legend>{m.settings_radio_image()}</legend>
				<r4-image-field>
					<ChannelAvatar src={preview ?? channel?.image} alt={name} />
					<input type="file" accept="image/png,image/jpeg,image/webp" onchange={pickImage} />
				</r4-image-field>
			</fieldset>
			<fieldset>
				<label for="radio-name">{m.common_name()}</label>
				<input
					id="radio-name"
					type="text"
					maxlength="64"
					bind:value={name}
					placeholder={appState.session.handle}
				/>
			</fieldset>
			<fieldset>
				<label for="radio-description">{m.common_description()}</label>
				<textarea id="radio-description" rows="3" maxlength="2000" bind:value={description}
				></textarea>
			</fieldset>
			<fieldset>
				<label for="radio-url">{m.settings_radio_link()}</label>
				<input id="radio-url" type="url" bind:value={url} placeholder="https://" />
			</fieldset>
			<fieldset>
				<legend>{m.settings_radio_location()}</legend>
				<small>{m.settings_radio_location_hint()}</small>
				<r4-geo-field>
					<label>
						{m.common_latitude()}
						<input type="number" step="any" min="-90" max="90" bind:value={latitude} />
					</label>
					<label>
						{m.common_longitude()}
						<input type="number" step="any" min="-180" max="180" bind:value={longitude} />
					</label>
				</r4-geo-field>
				<button type="button" aria-pressed={showMap} onclick={() => (showMap = !showMap)}>
					{showMap ? m.channel_edit_hide_map() : m.channel_edit_pick_on_map()}
				</button>
				{#if showMap}
					<MapPicker
						latitude={Number.parseFloat(latitude) || null}
						longitude={Number.parseFloat(longitude) || null}
						onselect={(point) => {
							// Coarse on purpose: about a kilometre is enough to place a radio
							latitude = point.latitude == null ? '' : point.latitude.toFixed(2)
							longitude = point.longitude == null ? '' : point.longitude.toFixed(2)
						}}
					/>
				{/if}
			</fieldset>
			<menu>
				<li>
					<button type="submit" disabled={saving} aria-busy={saving}>
						{saving ? `${m.common_save()}…` : m.common_save()}
					</button>
				</li>
				<li><a href={channelHref(appState.session.handle)}>{m.auth_go_to_radio()}</a></li>
			</menu>
			{#if saved}<p role="status">{m.settings_radio_saved()}</p>{/if}
			{#if error}<p role="alert">{m.channel_edit_failed()}: {error}</p>{/if}
		</form>
	{/if}
</r4-page>

<style>
	r4-image-field {
		display: flex;
		align-items: center;
		gap: var(--space-3);

		:global(r4-channel-avatar) {
			width: var(--channel-header-avatar-size);
			flex-shrink: 0;
		}
	}

	r4-geo-field {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-2);

		label {
			display: flex;
			flex-direction: column;
			gap: var(--space-1);
		}
	}
</style>
