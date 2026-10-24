<script lang="ts" module>
	import type {WithElementRef} from 'bits-ui'
	import type {HTMLAnchorAttributes, HTMLButtonAttributes} from 'svelte/elements'
	import {buttonVariants, type ButtonVariant, type ButtonSize} from './types'

	export type ButtonProps = WithElementRef<HTMLButtonAttributes> &
		WithElementRef<HTMLAnchorAttributes> & {
			variant?: ButtonVariant
			size?: ButtonSize
		}
</script>

<script lang="ts">
	import {resolve} from '$app/paths'
	import {cn} from '#lib/utils/index.js'

	let {
		class: className,
		variant = 'default',
		size = 'default',
		ref = $bindable(null),
		href = undefined,
		type = 'button',
		children,
		...restProps
	}: ButtonProps = $props()

	const isExternalHref = (value: string) => {
		return (
			/^(?:[a-z+.-]+:|\/\/)/i.test(value) ||
			value.startsWith('mailto:') ||
			value.startsWith('tel:') ||
			value.startsWith('#')
		)
	}

	const finalHref = $derived.by(() => {
		if (!href) return href
		if (isExternalHref(href)) return href
		return resolve(href)
	})
</script>

{#if href}
	<a
		bind:this={ref}
		class={cn(buttonVariants({variant, size}), className)}
		href={finalHref}
		{...restProps}
	>
		{@render children?.()}
	</a>
{:else}
	<button
		bind:this={ref}
		class={cn(buttonVariants({variant, size}), className)}
		{type}
		{...restProps}
	>
		{@render children?.()}
	</button>
{/if}
