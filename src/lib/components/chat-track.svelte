<script>
	import {ensureActiveDeck, playChannel} from '#lib/api.js'
	import {fetchTrack} from '#lib/collections/tracks.js'
	import {trackHref} from '#lib/links.js'
	import Icon from '#lib/components/icon.svelte'
	import * as m from '#lib/paraglide/messages.js'

	/** The track a chat message is about, with a button to play it from its radio. */
	/** @type {{uri: string}} */
	let {uri} = $props()

	/** @type {import('#lib/types.js').Track | undefined} */
	let track = $state()

	$effect(() => {
		const id = uri
		fetchTrack(id).then((t) => {
			if (id === uri) track = t
		})
	})

	function play() {
		if (track) playChannel(ensureActiveDeck().id, {id: track.did, slug: track.slug}, track.id)
	}
</script>

{#if track}
	<r4-chat-track>
		<button type="button" onclick={play} title={m.common_play()} aria-label={m.common_play()}>
			<Icon icon="play-fill" size={14} />
		</button>
		<a href={trackHref(track)}>{track.title}</a>
	</r4-chat-track>
{/if}

<style>
	r4-chat-track {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		width: fit-content;
		max-width: 100%;
		margin-block-start: var(--space-1);
		padding: var(--space-1) var(--space-2);
		background: var(--color-interface);
		border: 1px solid var(--color-interface-border);
		border-radius: var(--border-radius);
		font-size: var(--font-3);

		button {
			min-width: 0;
			min-height: 0;
			padding: var(--space-1);
		}

		a {
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}
	}
</style>
