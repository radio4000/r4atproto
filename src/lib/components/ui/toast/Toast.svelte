<script lang="ts">
	import {removeToast, type Toast} from '#lib/stores/toast.svelte.js'
	import {CircleCheck, CircleAlert, Info, X} from 'lucide-svelte'
	import {fly} from 'svelte/transition'

	interface Props {
		toast: Toast
	}

	let {toast}: Props = $props()

	const icons = {
		success: CircleCheck,
		error: CircleAlert,
		warning: CircleAlert,
		info: Info
	}

	const colors = {
		success:
			'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800 text-green-900 dark:text-green-100',
		error:
			'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800 text-red-900 dark:text-red-100',
		warning:
			'bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800 text-yellow-900 dark:text-yellow-100',
		info: 'bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-100'
	}

	const iconColors = {
		success: 'text-green-600 dark:text-green-400',
		error: 'text-red-600 dark:text-red-400',
		warning: 'text-yellow-600 dark:text-yellow-400',
		info: 'text-blue-600 dark:text-blue-400'
	}

	const Icon = icons[toast.type]

	function handleDismiss() {
		removeToast(toast.id)
	}
</script>

<div
	role="alert"
	aria-live="polite"
	class="flex items-start gap-3 rounded-lg border p-4 shadow-lg {colors[toast.type]} max-w-md"
	transition:fly={{y: -20, duration: 300}}
>
	<Icon class="h-5 w-5 flex-shrink-0 {iconColors[toast.type]}" />

	<p class="flex-1 text-sm font-medium">
		{toast.message}
	</p>

	<button
		type="button"
		onclick={handleDismiss}
		class="flex-shrink-0 opacity-70 hover:opacity-100 transition-opacity"
		aria-label="Dismiss notification"
	>
		<X class="h-4 w-4" />
	</button>
</div>
