<script>
	/* eslint svelte/no-at-html-tags: "off" */
	import {onMount} from 'svelte'
	import {tooltipState} from './tooltip-attachment.svelte.js'
	import {uuid} from '#lib/utils.js'

	const id = `tooltip-singleton-${uuid()}`
	// After mount, not at init: no `document` on the server, and both sides must start false.
	let supportsAnchorCss = $state(false)
	onMount(() => {
		supportsAnchorCss = 'anchorName' in document.documentElement.style
	})

	/** @type {HTMLElement | null} */
	let tooltipElement = $state(null)

	/** @type {HTMLElement | null} */
	let currentTarget = $state(null)

	$effect(() => {
		if (!supportsAnchorCss || !tooltipElement) return

		if (currentTarget && currentTarget.id !== tooltipState.targetId) {
			currentTarget.removeAttribute('aria-describedby')
			currentTarget.style.anchorName = ''
		}

		if (!tooltipState.visible || !tooltipState.targetId) {
			tooltipElement.hidePopover()
			return
		}

		const target = document.getElementById(tooltipState.targetId)
		if (!target) {
			tooltipElement.hidePopover()
			return
		}

		currentTarget = target
		const anchorName = `--anchor-${tooltipState.targetId}`

		target.setAttribute('aria-describedby', id)
		target.style.anchorName = anchorName
		tooltipElement.style.positionAnchor = anchorName

		tooltipElement.showPopover()
	})
</script>

{#if supportsAnchorCss}
	<r4-tooltip
		bind:this={tooltipElement}
		{id}
		popover="hint"
		role="tooltip"
		position={tooltipState.position}
	>
		{@html tooltipState.content}
	</r4-tooltip>
{/if}

<style>
	r4-tooltip {
		position: fixed;
		margin: 0;
		padding: var(--space-1) var(--space-2);
		font-size: var(--font-3);
		color: var(--gray-12);
		border: 1px solid var(--color-interface-border);
		background: var(--color-interface-elevated);
		border-radius: var(--border-radius);
		max-width: var(--tooltip-width);
		pointer-events: none;
	}

	/* Anchor positioning with auto-flip fallbacks */
	@supports (position-area: bottom) {
		@position-try --top {
			position-area: top;
		}
		@position-try --bottom {
			position-area: bottom;
		}
		@position-try --left {
			position-area: left;
		}
		@position-try --right {
			position-area: right;
		}

		r4-tooltip {
			inset: unset;
			margin: var(--space-1);
			position-try-fallbacks: --top, --bottom, --left, --right;
			position-visibility: anchors-visible;
		}
		r4-tooltip[position='top'] {
			position-area: top;
		}
		r4-tooltip[position='bottom'] {
			position-area: bottom;
		}
		r4-tooltip[position='left'] {
			position-area: left;
		}
		r4-tooltip[position='right'] {
			position-area: right;
		}
	}
</style>
