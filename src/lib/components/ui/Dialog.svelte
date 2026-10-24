<script lang="ts">
	import {
		Dialog as DialogRoot,
		DialogContent,
		DialogHeader,
		DialogTitle,
		DialogOverlay,
		DialogPortal
	} from './dialog/index'

	let {title, onClose, children} = $props()
	let open = $state(true)

	$effect(() => {
		if (!open && onClose) {
			onClose()
		}
	})
</script>

<DialogRoot bind:open>
	<DialogPortal>
		<DialogOverlay />
		<DialogContent>
			<DialogHeader>
				<DialogTitle class="text-lg font-semibold">{title}</DialogTitle>
			</DialogHeader>
			<div class="mt-4">
				{@render children()}
			</div>
		</DialogContent>
	</DialogPortal>
</DialogRoot>
