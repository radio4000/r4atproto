<script lang="ts">
	import Skeleton from './Skeleton.svelte'

	interface Props {
		count?: number
	}

	let {count = 5}: Props = $props()

	const items = Array.from({length: count}, (_, i) => i)
</script>

<div class="flex flex-col gap-3" aria-label="Loading tracks...">
	{#each items as item (item)}
		<div class="rounded-lg border p-4 space-y-3">
			<!-- Track title -->
			<Skeleton class="h-5 w-3/4" />

			<!-- Track description -->
			<Skeleton class="h-4 w-full" />
			<Skeleton class="h-4 w-2/3" />

			<!-- Action buttons -->
			<div class="flex gap-2 pt-2">
				<Skeleton class="h-8 w-20" />
				<Skeleton class="h-8 w-20" />
			</div>
		</div>
	{/each}
</div>
