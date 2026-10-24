<script lang="ts">
	import {createEventDispatcher, onMount} from 'svelte'
	const dispatch = createEventDispatcher()
	const {title = '', onClose = () => {}} = $props()
	function close() {
		onClose()
		dispatch('close')
	}
	function onBackdrop(e) {
		if (e.target === e.currentTarget) close()
	}
	function onKey(e) {
		if (e.key === 'Escape') close()
	}
	onMount(() => {
		const h = (e) => onKey(e)
		window.addEventListener('keydown', h)
		return () => window.removeEventListener('keydown', h)
	})
</script>

<div role="dialog" aria-modal="true" on:click={onBackdrop}>
	<div>
		<header>
			<h3>{title}</h3>
			<button on:click={close} aria-label="Close">×</button>
		</header>
		<section>
			<slot />
		</section>
	</div>
</div>
