<script>
	import {Debounced} from 'runed'
	import Icon from '#lib/components/icon.svelte'
	import {afterNavigate} from '$app/navigation'
	import {onMount, untrack} from 'svelte'
	import * as m from '#lib/paraglide/messages.js'

	/* A normal input, but with a search icon "inside" (on top) */
	let {
		value = $bindable(''),
		placeholder: placeholderText = m.search_placeholder(),
		debounce = 0,
		...restProps
	} = $props()

	let inputValue = $state(value)
	let lastExternalValue = value
	let input

	// Only sync when value changes externally (e.g. programmatic clear)
	$effect(() => {
		if (value !== lastExternalValue) {
			lastExternalValue = value
			inputValue = value
		}
	})

	// svelte-ignore state_referenced_locally
	const debounced = new Debounced(() => inputValue, debounce)

	// Emit debounced value to parent. Only when it changes: re-running on an external
	// change would send back the stale debounced value (a ?q= link briefly dropped ?q=).
	$effect(() => {
		const v = debounced.current
		untrack(() => {
			if (v !== value) {
				value = v
				lastExternalValue = v
			}
		})
	})

	function focusInput() {
		if (restProps.autofocus) input?.focus({preventScroll: true})
	}

	onMount(focusInput)
	afterNavigate((nav) => !nav.shallow && focusInput())

	function clear() {
		inputValue = ''
		value = ''
		lastExternalValue = ''
	}
</script>

<r4-search-input>
	<Icon icon="search" />
	<input
		bind:this={input}
		type="search"
		placeholder={placeholderText}
		bind:value={inputValue}
		{...restProps}
	/>
	{#if inputValue}
		<button title={m.common_clear()} onclick={clear} type="button">
			<Icon icon="close" />
		</button>
	{/if}
</r4-search-input>

<style>
	r4-search-input {
		position: relative;
		display: flex;
		align-items: center;
		flex: 1;
		min-width: 0;
	}

	r4-search-input > :global(r4-icon) {
		position: absolute;
		inset-inline-start: var(--space-2);
		z-index: 1;
		opacity: 0.5;
	}

	input[type='search'] {
		flex: 1;
		min-width: 0;
		padding-inline: 1.8rem 1.5rem;

		/* hide the browser's own clear button */
		&::-webkit-search-cancel-button {
			display: none;
		}
	}

	button {
		position: absolute;
		inset-inline-end: var(--space-1);
		min-width: 0;
		min-height: 0;
		padding: var(--space-1);
		background: none;
		border: none;
		opacity: 0.5;
		color: inherit;

		&:hover {
			opacity: 1;
			background: none;
		}
	}
</style>
