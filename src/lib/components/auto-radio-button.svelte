<script lang="ts">
	import Icon from '#lib/components/icon.svelte'
	import {tooltip} from '#lib/components/tooltip-attachment.svelte.js'
	import * as m from '#lib/paraglide/messages.js'

	let {
		live = false,
		drifted = false,
		title,
		ariaLabel,
		size = 16,
		showLabel = false,
		...rest
	}: {
		live?: boolean
		drifted?: boolean
		title?: string
		ariaLabel?: string
		size?: number
		showLabel?: boolean
		[key: string]: unknown
	} = $props()

	// Pressed = engaged and in sync. Drifted reads as a resync call to action, so it drops pressed.
	// Live and synced makes it a toggle: clicking leaves auto-radio.
	const resolvedTitle = $derived(
		title ?? (drifted ? m.auto_radio_resync() : live ? m.auto_radio_leave() : m.auto_radio_join())
	)
</script>

<button
	type="button"
	aria-pressed={live && !drifted}
	aria-label={ariaLabel ?? resolvedTitle}
	data-drifted={drifted}
	{...rest}
	{@attach tooltip({content: resolvedTitle})}
>
	<Icon icon="infinite" {size} />
	{#if showLabel}
		<span>{m.common_auto()}</span>
	{/if}
</button>

<style>
	button[data-drifted='true'] {
		color: var(--color-warning);
	}
</style>
