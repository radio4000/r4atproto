<script lang="ts">
	/** Removable chips showing the active filter selection — same UI wherever tags can be filtered. */
	let {
		tags = [],
		channels = [],
		matching = '',
		mention = '',
		search = '',
		onRemoveTag,
		onRemoveChannel,
		onClearMatching,
		onClearMention
	}: {
		tags?: string[]
		channels?: string[]
		matching?: string
		mention?: string
		search?: string
		onRemoveTag?: (tag: string) => void
		onRemoveChannel?: (slug: string) => void
		onClearMatching?: () => void
		onClearMention?: () => void
	} = $props()
</script>

<r4-filter-chips>
	<menu>
		{#if search}
			<li><output>"{search}"</output></li>
		{/if}
		{#if mention}
			<li><button type="button" onclick={onClearMention}>@{mention} ×</button></li>
		{/if}
		{#if matching}
			<li><button type="button" onclick={onClearMatching}>@{matching} ×</button></li>
		{/if}
		{#each channels as slug (slug)}
			<li><button type="button" onclick={() => onRemoveChannel?.(slug)}>@{slug} ×</button></li>
		{/each}
		{#each tags as tag (tag)}
			<li><button type="button" onclick={() => onRemoveTag?.(tag)}>#{tag} ×</button></li>
		{/each}
	</menu>
</r4-filter-chips>

<style>
	button,
	output {
		border-radius: calc(var(--border-radius) * 999);
		padding: 0 var(--space-2);
	}

	output {
		display: inline-flex;
		align-items: center;
		min-height: var(--control-size);
	}
</style>
