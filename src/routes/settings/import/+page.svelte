<script>
	import {appState} from '#lib/app-state.svelte.js'
	import {
		fetchRadio4000Channel,
		fetchRadio4000Tracks,
		importRadio4000Tracks
	} from '#lib/radio4000-import.js'
	import {updateChannel} from '#lib/collections/channels.js'
	import {queryClient} from '#lib/collections/query-client.js'
	import {channelHref} from '#lib/links.js'
	import SettingsHeader from '#lib/components/settings-header.svelte'
	import Seo from '#lib/components/seo.svelte'
	import * as m from '#lib/paraglide/messages.js'

	let slug = $state('')
	let found = $state(
		/** @type {{name: string, description?: string | null, count: number} | null} */ (null)
	)
	let busy = $state(false)
	let progress = $state(/** @type {{done: number, total: number} | null} */ (null))
	let result = $state(/** @type {{imported: number, skipped: number} | null} */ (null))
	let error = $state('')

	// Start from the slug this radio was imported from before, if any
	$effect(() => {
		if (!slug && appState.channel?.r4_slug) slug = appState.channel.r4_slug
	})

	async function find(event) {
		event.preventDefault()
		busy = true
		error = ''
		found = null
		result = null
		try {
			const channel = await fetchRadio4000Channel(slug.trim())
			if (!channel) {
				error = m.settings_import_not_found()
				return
			}
			const tracks = await fetchRadio4000Tracks(slug.trim())
			found = {name: channel.name, description: channel.description, count: tracks.length}
		} catch (err) {
			error = err instanceof Error ? err.message : String(err)
		} finally {
			busy = false
		}
	}

	async function start() {
		if (!found) return
		busy = true
		error = ''
		progress = {done: 0, total: found.count}
		try {
			result = await importRadio4000Tracks(slug.trim(), (done, total) => (progress = {done, total}))
			// Remember the origin, and adopt the name and description if the radio has none
			const own = appState.channel
			appState.channel = await updateChannel({
				r4_slug: slug.trim(),
				name: own?.has_record ? undefined : found.name,
				description: own?.has_record ? undefined : (found.description ?? undefined)
			})
			await queryClient.invalidateQueries({queryKey: ['tracks']})
		} catch (err) {
			error = err instanceof Error ? err.message : String(err)
		} finally {
			busy = false
			progress = null
		}
	}
</script>

<Seo title={m.settings_import()} />

<r4-page size="narrow">
	<SettingsHeader title={m.settings_import()} />
	{#if !appState.session}
		<r4-empty
			><p><a href="/auth?redirect=/settings/import">{m.settings_signed_out()}</a></p></r4-empty
		>
	{:else}
		<p>{m.settings_import_intro()}</p>
		<form onsubmit={find}>
			<fieldset>
				<label for="import-slug">{m.settings_import_slug()}</label>
				<input
					id="import-slug"
					type="text"
					required
					autocapitalize="none"
					bind:value={slug}
					placeholder="ko002"
				/>
			</fieldset>
			<button type="submit" disabled={busy} aria-busy={busy}>{m.settings_import_find()}</button>
		</form>

		{#if found}
			<r4-box>
				<h2>{found.name}</h2>
				{#if found.description}<p>{found.description}</p>{/if}
				{#if result}
					<p role="status">
						{m.settings_import_done({imported: result.imported, skipped: result.skipped})}
					</p>
					<a href={channelHref(appState.session.handle)}>{m.auth_go_to_radio()}</a>
				{:else if progress}
					<progress value={progress.done} max={progress.total}></progress>
					<p role="status">
						{m.settings_import_progress({done: progress.done, total: progress.total})}
					</p>
				{:else}
					<button type="button" onclick={start} disabled={busy}
						>{m.settings_import_start({count: found.count})}</button
					>
				{/if}
			</r4-box>
		{/if}
		{#if error}<p role="alert">{error}</p>{/if}
	{/if}
</r4-page>

<style>
	progress {
		width: 100%;
		accent-color: var(--accent-9);
	}
</style>
