<script>
	import {appState} from '#lib/app-state.svelte.js'
	import {getBroadcastingChannelId, startBroadcast, stopBroadcast} from '#lib/broadcast.js'
	import Icon from '#lib/components/icon.svelte'
	import * as m from '#lib/paraglide/messages.js'

	/** @type {{label?: boolean}} */
	let {label = false} = $props()

	const live = $derived(
		Boolean(appState.session && getBroadcastingChannelId() === appState.session.did)
	)
	let busy = $state(false)
	let error = $state('')

	async function toggle() {
		busy = true
		error = ''
		try {
			if (live) await stopBroadcast()
			else if (!(await startBroadcast())) error = m.broadcast_requires_track()
		} catch (err) {
			error = err instanceof Error ? err.message : String(err)
		} finally {
			busy = false
		}
	}

	const text = $derived(live ? m.broadcast_stop_button() : m.broadcast_start_button())
</script>

{#if appState.session}
	<button
		type="button"
		onclick={toggle}
		aria-pressed={live}
		aria-busy={busy}
		disabled={busy}
		title={error || text}
		aria-label={text}
	>
		<Icon icon="signal" />
		{#if label}<span>{live ? m.status_broadcasting() : m.nav_broadcast()}</span>{/if}
	</button>
{/if}
