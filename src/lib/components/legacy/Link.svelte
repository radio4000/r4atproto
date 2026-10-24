<script lang="ts">
	import {resolve} from '$app/paths'
	import type {HTMLAnchorAttributes} from 'svelte/elements'

	type Props = HTMLAnchorAttributes & {
		href?: string
		external?: boolean
	}

	const {
		href = '',
		external = false,
		target = undefined,
		rel = undefined,
		children,
		...restProps
	}: Props = $props()

	const isExternalScheme = (value: string) => {
		return (
			/^(?:[a-z+.-]+:|\/\/)/i.test(value) || value.startsWith('mailto:') || value.startsWith('tel:')
		)
	}

	const finalHref = $derived.by(() => {
		if (!href) return href
		if (external || isExternalScheme(href) || href.startsWith('#')) return href
		return resolve(href)
	})

	const computedRel = $derived(() => {
		if (rel) return rel
		if (target === '_blank') return 'noopener noreferrer'
		return undefined
	})
</script>

<a href={finalHref} {target} rel={computedRel} {...restProps}>
	{@render children?.()}
</a>
