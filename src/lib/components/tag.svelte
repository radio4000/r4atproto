<script>
	import {appState} from '#lib/app-state.svelte.js'
	import {page} from '$app/state'

	/** @type {{href?: string, onclick?: () => void, value?: string, playing?: boolean, filtered?: boolean, deckId?: number, children: import('svelte').Snippet}} */
	const {href, onclick, value, playing, filtered, deckId, children} = $props()

	const splitRe = /\s+/

	const matchesTitle = (title) =>
		Boolean(value && title?.toLowerCase().split(splitRe).includes(value.toLowerCase()))

	// A deck-scoped tag (rendered inside a specific deck's header/queue) only
	// reflects that deck's own theme — otherwise a tag playing in one open
	// deck would also light up the same tag shown in every other deck.
	const isPlaying = $derived(
		playing ??
			(deckId != null
				? matchesTitle(appState.decks[deckId]?.playlist_title)
				: Object.values(appState.decks).some((d) => matchesTitle(d.playlist_title)))
	)

	const isFiltered = $derived.by(() => {
		if (filtered !== undefined) return filtered
		if (!value) return false
		const urlTags = page.url.searchParams.get('tags')?.split(',').filter(Boolean) ?? []
		return urlTags.some((t) => `#${t.toLowerCase()}` === value.toLowerCase())
	})
</script>

<r4-tag playing={isPlaying} filtered={isFiltered}>
	{#if href}
		<a {href}>{@render children()}</a>
	{:else}
		<button type="button" {onclick}>{@render children()}</button>
	{/if}
</r4-tag>

<style>
	/* One quiet default look, and two ways to stand out: text color for
	   "playing", a soft tint for "filtered". Separate channels on purpose, so a
	   tag that is both shows both cues. */
	r4-tag {
		display: inline;
	}

	a,
	button {
		display: inline;
		vertical-align: baseline;
		padding: 0.0625em 0.25em;
		min-height: 0;
		min-width: 0;
		border-radius: calc(var(--border-radius) * 999);
		border: none;
		text-decoration: none;
		font: inherit;
		color: var(--tag-color, inherit);
		background: var(--tag-bg, var(--gray-2));
		white-space: nowrap;
		transition:
			background var(--duration-2),
			color var(--duration-2);

		&:hover {
			background: var(--tag-bg-hover, var(--gray-3));
			text-decoration: none;
		}

		&:active {
			scale: 1;
			background: var(--tag-bg-active, var(--gray-4));
			text-decoration: underline;
		}
	}

	r4-tag[playing='true'] :is(a, button) {
		color: var(--accent-9);
		font-weight: 600;
	}

	r4-tag[filtered='true'] :is(a, button) {
		background: var(--accent-3);
		color: var(--accent-11);

		&:hover {
			background: var(--accent-4);
		}
	}
</style>
