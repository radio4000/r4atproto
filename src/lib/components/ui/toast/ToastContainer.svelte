<script lang="ts">
	import {getToasts} from '#lib/stores/toast.svelte.js'
	import Toast from './Toast.svelte'

	const toasts = $derived(getToasts())
</script>

<!-- Toast container positioned at top-right of viewport -->
<div
	class="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none"
	aria-live="polite"
	aria-atomic="false"
>
	{#each toasts as toast (toast.id)}
		<div class="pointer-events-auto">
			<Toast {toast} />
		</div>
	{/each}
</div>
