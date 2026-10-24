<script>
	import Icon from '#lib/components/icon.svelte'
	import * as m from '#lib/paraglide/messages.js'

	/** @type {{title: string}} */
	let {title} = $props()
</script>

<r4-page-header>
	<h1>
		<a href="/settings" aria-label={m.common_back()} title={m.common_back()}
			><Icon icon="arrow-left" /></a
		>
		{title}
	</h1>
</r4-page-header>

<style>
	h1 {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}

	a {
		display: inline-flex;
		color: var(--gray-10);
	}
</style>
