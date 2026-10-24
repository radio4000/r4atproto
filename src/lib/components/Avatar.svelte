<script lang="ts">
	import {User} from 'lucide-svelte'
	import {cn} from '#lib/utils/index.js'

	const {src = '', alt = '', size = 'md', class: extraClass = ''} = $props()

	const sizeClasses = {
		sm: 'h-8 w-8',
		md: 'h-12 w-12',
		lg: 'h-16 w-16',
		xl: 'h-24 w-24'
	}

	const iconSizes = {
		sm: 'h-4 w-4',
		md: 'h-6 w-6',
		lg: 'h-8 w-8',
		xl: 'h-12 w-12'
	}

	let imageLoaded = $state(!!src)
	let imageError = $state(false)

	function handleLoad() {
		imageLoaded = true
		imageError = false
	}

	function handleError() {
		imageError = true
		imageLoaded = false
	}
</script>

{#if src && !imageError}
	<img
		{src}
		{alt}
		class={cn(
			'rounded-full object-cover border-2 border-primary/30',
			sizeClasses[size],
			extraClass
		)}
		onload={handleLoad}
		onerror={handleError}
	/>
{:else}
	<div
		class={cn(
			'rounded-full bg-primary/10 flex items-center justify-center border-2 border-primary/30',
			sizeClasses[size],
			extraClass
		)}
	>
		<User class={cn('text-primary', iconSizes[size])} />
	</div>
{/if}
