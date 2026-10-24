<script lang="ts">
	import Icon from '#lib/components/icon.svelte'

	let {src, alt = ''}: {src?: string | null; alt?: string | null} = $props()

	let loaded = $state(false)
</script>

<r4-channel-avatar loaded={loaded || !src}>
	{#if src}
		<img loading="lazy" {src} alt={alt ?? ''} onload={() => (loaded = true)} />
	{:else}
		<span role={alt ? 'img' : undefined} aria-label={alt || undefined}>
			<Icon icon="user" />
		</span>
	{/if}
</r4-channel-avatar>

<style>
	r4-channel-avatar {
		display: flex;
		width: 100%;
		aspect-ratio: 1;
		border-radius: var(--media-radius);
		overflow: hidden;
	}

	img,
	span {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	r4-channel-avatar[loaded='false'] {
		background: linear-gradient(110deg, var(--gray-3) 30%, var(--gray-4) 50%, var(--gray-3) 70%);
		background-size: 200% 100%;
		animation: wave 2.4s ease-in-out infinite;
	}

	@keyframes wave {
		0% {
			background-position: 150% 0;
		}
		100% {
			background-position: -50% 0;
		}
	}

	span {
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--gray-3);
		color: var(--gray-11);
	}

	span :global(svg) {
		width: 55%;
		height: 55%;
	}
</style>
