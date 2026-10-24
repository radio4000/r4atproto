<script lang="ts">
	import {cn} from '#lib/utils/index.js'

	interface Props {
		class?: string
	}

	let {class: className}: Props = $props()
</script>

<div class={cn('animate-pulse rounded-md bg-muted', className)} aria-hidden="true"></div>
