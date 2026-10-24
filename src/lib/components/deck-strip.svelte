<script>
	import {page} from '$app/state'
	import {scale} from 'svelte/transition'
	import {cubicOut} from 'svelte/easing'
	import {appState, deckAccent} from '#lib/app-state.svelte.js'
	import {showPlayerParam, sortedDeckIds, sortedListeningDeckIds} from '#lib/deck.js'
	import {useLiveQuery} from '#lib/useLiveQuery.svelte.js'
	import {inArray} from '@tanstack/db'
	import {resyncBroadcastDeck} from '#lib/broadcast.js'
	import {channelsCollection} from '#lib/collections/channels.js'
	import {channelPresence} from '#lib/presence.svelte.js'
	import Deck from '#lib/components/deck.svelte'
	import Icon from '#lib/components/icon.svelte'
	import * as m from '#lib/paraglide/messages.js'

	let deckIds = $derived(sortedDeckIds(appState.decks))
	let listeningDeckIds = $derived(sortedListeningDeckIds(appState.decks))
	let videoMixListening = $derived(
		listeningDeckIds.some((id) =>
			Boolean(appState.decks[id]?.video_mix && !appState.decks[id]?.compact)
		)
	)
	let localDeckIds = $derived(deckIds.filter((id) => !appState.decks[id]?.listening_to_channel_id))
	let allDecksCompact = $derived(
		deckIds.length > 0 && deckIds.every((id) => appState.decks[id]?.compact)
	)
	let showPlayer = $derived(showPlayerParam(page.url))
	// No play history in this app: deck 1 shows once it has something queued
	const hasHistory = false
	let visibleDeckIds = $derived.by(() =>
		deckIds.filter((id) => {
			const deck = appState.decks[id]
			if (!deck || deck.compact || !showPlayer) return false
			if (id !== 1) return true
			return (deck.playlist_tracks?.length ?? 0) > 0 || Boolean(deck.playlist_track) || hasHistory
		})
	)
	let singleVisibleDeck = $derived(visibleDeckIds.length === 1)
	let singleVisibleNonCompactDeck = $derived(visibleDeckIds.length === 1)

	// Non-compact decks in live mode — shared exit bar
	let visibleListeningDeckIds = $derived(
		visibleDeckIds.filter((id) => Boolean(appState.decks[id]?.listening_to_channel_id))
	)
	let expandedListeningMultiDeck = $derived(
		visibleListeningDeckIds.length > 0 &&
			visibleDeckIds.length > 1 &&
			visibleListeningDeckIds.some((id) => Boolean(appState.decks[id]?.expanded))
	)
	let visibleListeningDecksSynced = $derived(
		visibleListeningDeckIds.length > 0 &&
			visibleListeningDeckIds.every((id) => !appState.decks[id]?.listening_drifted)
	)
	// Reactive slug lookup for the (few) channels currently being listened to.
	const listeningChannelIds = $derived(
		/** @type {string[]} */ (
			visibleListeningDeckIds
				.map((id) => appState.decks[id]?.listening_to_channel_id)
				.filter(Boolean)
		)
	)
	const listeningChannelsQuery = useLiveQuery((q) =>
		q.from({ch: channelsCollection}).where(({ch}) => inArray(ch.id, listeningChannelIds))
	)
	let listenPresenceCount = $derived.by(() => {
		const rows = listeningChannelsQuery.data ?? []
		let total = 0
		for (const id of visibleListeningDeckIds) {
			const channelId = appState.decks[id]?.listening_to_channel_id
			if (!channelId) continue
			const slug = rows.find((ch) => ch.id === channelId)?.slug
			if (!slug) continue
			total += channelPresence[slug]?.broadcast ?? 0
		}
		return total
	})
</script>

<r4-deck-strip
	all-compact={allDecksCompact}
	single-visible={singleVisibleDeck}
	single-visible-noncompact={singleVisibleNonCompactDeck}
	expanded-listening={expandedListeningMultiDeck}
	video-mix-listening={videoMixListening}
>
	<r4-deck-sections>
		{#if localDeckIds.length}
			<r4-local-decks>
				{#each localDeckIds as deckId (deckId)}
					<r4-deck-item
						style:--deck-accent={deckAccent(deckIds, deckId)}
						out:scale={{duration: 150, start: 0.96, opacity: 0, easing: cubicOut}}
					>
						<Deck {deckId} {hasHistory} />
					</r4-deck-item>
				{/each}
			</r4-local-decks>
		{/if}
		{#if listeningDeckIds.length}
			<r4-listening-decks video-mix={videoMixListening} aria-label={m.decks_broadcast_listeners()}>
				{#each listeningDeckIds as deckId (deckId)}
					<r4-deck-item
						style:--deck-accent={deckAccent(deckIds, deckId)}
						out:scale={{duration: 150, start: 0.96, opacity: 0, easing: cubicOut}}
					>
						<Deck {deckId} {hasHistory} />
					</r4-deck-item>
				{/each}
				{#if visibleListeningDeckIds.length}
					<r4-deck-sync-bar>
						<button
							type="button"
							aria-pressed={visibleListeningDecksSynced}
							onclick={() => visibleListeningDeckIds.forEach((id) => resyncBroadcastDeck(id))}
						>
							<Icon icon="signal" size={12} />
							{visibleListeningDecksSynced
								? m.decks_compact_sync_live()
								: m.decks_compact_sync_action()}
							{#if listenPresenceCount > 0}<small>{listenPresenceCount}</small>{/if}
						</button>
					</r4-deck-sync-bar>
				{/if}
			</r4-listening-decks>
		{/if}
	</r4-deck-sections>
</r4-deck-strip>

<style>
	r4-deck-strip {
		display: flex;
		flex-direction: column;
		flex-shrink: 0;
		min-height: 0;
		overflow: clip;
		gap: var(--floating-gap);

		&:empty {
			display: none;
		}

		/* Universal (applies under every breakpoint's own flex/width values
		   below) — smoothly resizes as decks collapse to compact, expand to
		   fullscreen, or make room for a sibling that does either. */
		r4-deck-item {
			transition:
				flex var(--duration-2) var(--ease-out),
				width var(--duration-2) var(--ease-out);
		}

		&[all-compact='true'] {
			height: 0;
			flex: 0 0 0;
			overflow: hidden;
		}

		r4-deck-sections {
			display: flex;
			flex-direction: row;
			gap: var(--space-1);
			flex: 1 1 auto;
			min-height: 0;
			overflow-x: auto;
			overflow-y: hidden;
		}

		r4-local-decks {
			display: flex;
			flex-direction: row;
			flex: 0 0 auto;
			min-height: 0;
			min-width: max-content;
			gap: var(--floating-gap);
			border-radius: var(--border-radius);

			&:has(:global(r4-deck[broadcasting='true'])) {
				box-shadow: inset 0 0 0 1px var(--accent-9);
			}
		}

		r4-listening-decks {
			display: flex;
			flex-direction: column;
			min-height: 0;
			height: 100%;
			overflow-y: auto;
			flex: 1 1 auto;
			min-width: min-content;
			gap: var(--floating-gap);

			:global(r4-deck[listening='true']),
			:global(r4-deck[auto='true']) {
				min-width: 0;
				flex: 1 1 auto;
			}

			/* Listening/auto-radio deck: lift the 25dvh video cap so it fills available height */
			:global(
				r4-deck[listening='true']:not([compact='true']):not([hide-video='true']) media-controller
			),
			:global(
				r4-deck[auto='true']:not([compact='true']):not([hide-video='true']) media-controller
			) {
				flex: 1 1 auto;
				min-height: 0;
				max-height: none;
				aspect-ratio: auto;
			}

			r4-deck-item {
				flex: 1 1 auto;
				min-width: 0;
			}
		}

		/* Video mix: stack listening deck videos into one layered viewport */
		r4-listening-decks[video-mix='true'] {
			--video-mix-stage-height: clamp(16rem, 62dvh, 80dvh);
			--video-mix-stage-gap: var(--space-1);
			isolation: isolate;
			position: relative;
		}

		/* In mix mode, deck rows should only use their intrinsic chrome height */
		r4-listening-decks[video-mix='true'] r4-deck-item {
			flex: 0 0 auto;
		}

		/* Reserve one shared stage below all listening deck rows */
		r4-listening-decks[video-mix='true']::after {
			content: '';
			display: block;
			height: var(--video-mix-stage-height);
			margin-top: var(--video-mix-stage-gap);
			background: black;
			border-radius: var(--border-radius);
		}

		r4-listening-decks[video-mix='true'] :global(r4-deck[listening='true'][video-mix='true']) {
			position: static;
			overflow: visible;
			min-width: 200px;
			height: auto;
			min-height: 0;
		}

		/* Compact the per-deck chrome so the shared video stage can grow */
		r4-listening-decks[video-mix='true']
			:global(r4-deck[listening='true'][video-mix='true'] > r4-deck-body > r4-player > header) {
			padding: var(--space-1) var(--space-1);
			gap: var(--space-1);
		}

		r4-listening-decks[video-mix='true']
			:global(r4-deck[listening='true'][video-mix='true'] r4-player > section) {
			border-top-width: 0;
		}

		r4-listening-decks[video-mix='true']
			:global(
				r4-deck[listening='true'][video-mix='true']
					r4-player
					> section
					> footer
					r4-track-card
					> article
			) {
			padding-block: 0.18rem;
		}

		r4-listening-decks[video-mix='true']
			:global(r4-deck[listening='true'][video-mix='true'] r4-player > section > menu) {
			padding: 0.22rem var(--space-1) var(--space-1);
			gap: var(--space-1);
		}

		r4-listening-decks[video-mix='true']
			:global(r4-deck[listening='true'][video-mix='true'] r4-player-placeholder) {
			display: none;
		}

		r4-listening-decks[video-mix='true']
			:global(r4-deck[listening='true'][video-mix='true'] media-controller) {
			position: absolute;
			inset-block-end: 0;
			inset-inline: 0;
			width: 100%;
			height: var(--video-mix-stage-height);
			max-height: none;
			aspect-ratio: auto;
			opacity: var(--video-mix-opacity, 1);
			transition:
				opacity 120ms ease,
				filter 220ms ease;
			z-index: var(--video-mix-z, 10);
			pointer-events: none;
			mix-blend-mode: screen;
			filter: saturate(1.2) contrast(1.08) brightness(0.95);
		}

		r4-listening-decks[video-mix='true']
			r4-deck-item:nth-child(2n)
			:global(r4-deck[listening='true'][video-mix='true'] media-controller) {
			mix-blend-mode: lighten;
			filter: hue-rotate(-8deg) saturate(1.25) contrast(1.1) brightness(0.92);
		}

		r4-listening-decks[video-mix='true']
			r4-deck-item:nth-child(3n)
			:global(r4-deck[listening='true'][video-mix='true'] media-controller) {
			mix-blend-mode: color-dodge;
			filter: hue-rotate(10deg) saturate(1.15) contrast(1.12) brightness(0.9);
		}

		r4-deck-item {
			display: flex;
			flex: 1 1 auto;
			min-height: 0;
			min-width: 0;

			/* Compact decks keep media alive but must not reserve strip width. */
			&:has(:global(r4-deck[compact='true'])) {
				flex: 0 0 0;
				width: 0;
				min-width: 0;
				overflow: hidden;
			}
		}

		/* When an expanded deck is present, non-expanded siblings must not grow */
		r4-local-decks:has(:global(r4-deck[expanded='true']:not([compact='true']))) r4-deck-item {
			flex: 0 0 auto;
		}

		/* Expanded decks should always consume available strip space */
		r4-deck-item:has(:global(r4-deck[expanded='true']:not([compact='true']))) {
			flex: 1 1 0;
			width: 100%;
			min-width: 0;
			min-height: 0;
		}

		r4-local-decks:has(:global(r4-deck[expanded='true']:not([compact='true']))) {
			flex: 1 1 auto;
			min-width: 0;
			width: 100%;
		}

		r4-deck-sync-bar {
			display: flex;
			padding: var(--space-1) 0.5rem 0.5rem;
			flex-shrink: 0;
		}

		r4-deck-sync-bar button {
			flex: 1;
			display: inline-flex;
			align-items: center;
			justify-content: center;
			gap: var(--space-1);
			font-size: var(--font-2);
			padding: var(--space-1) var(--space-2);
			border-radius: var(--border-radius);
			white-space: nowrap;
		}

		@media (min-width: 769px) {
			r4-deck-sections {
				width: fit-content;
				max-width: 72vw;
				min-width: 0;
			}

			r4-deck-sections:has(:global(r4-deck[expanded='true']:not([compact='true']))) {
				width: 100%;
				max-width: none;
			}

			&[expanded-listening='true'] {
				r4-deck-sections {
					flex-direction: column;
					width: 100%;
					max-width: none;
				}

				r4-local-decks,
				r4-listening-decks {
					width: 100%;
					min-width: 0;
				}

				:global(r4-deck[expanded='true']:not([compact='true'])) {
					width: 100% !important;
					min-width: 0;
					flex: 1 1 auto;
				}
			}

			&[single-visible='true'] r4-deck-sections {
				width: 100%;
				max-width: none;
			}

			&[single-visible='true'] {
				r4-local-decks,
				r4-listening-decks {
					flex: 1 1 auto;
					min-width: 0;
					width: 100%;
				}

				r4-deck-item {
					flex: 0 0 auto;

					&:has(:global(r4-deck:not([compact='true']))) {
						flex: 1 1 auto;
						min-width: 0;
					}
				}

				:global(r4-deck:not([compact='true'])) {
					width: 100% !important;
					min-width: 0;
					flex: 1 1 auto;
				}

				:global(r4-deck[listening='true']:not([compact='true'])),
				:global(r4-deck[auto='true']:not([compact='true'])) {
					width: 100%;
					min-width: 0;
				}
			}
		}

		/* "fill deck": non-compact with at least one visible panel (video or queue) */
		@media (max-width: 768px) {
			r4-deck-sections {
				flex-direction: column;
				height: auto;
				overflow-y: auto;
				overflow-x: hidden;
			}

			&:not([all-compact='true']) {
				flex: 0 1 auto;
				min-height: 0;

				/* grow to fill available height when any deck has visible content */
				&:has(
					:global(
						r4-deck:not([compact='true']):is(
								:not([hide-video='true']),
								[listening='true'],
								[auto='true'],
								:not([listening='true']):not([auto='true']):not([hide-queue='true'])
							)
					)
				) {
					flex: 1 1 0;
					min-height: 100%;
				}
			}

			r4-local-decks {
				flex-direction: column;
				min-height: 0;
				min-width: 0;

				/* sections with fill decks share the strip height */
				&:has(
					:global(
						r4-deck:not([compact='true']):is(
								:not([hide-video='true']),
								[listening='true'],
								[auto='true'],
								:not([listening='true']):not([auto='true']):not([hide-queue='true'])
							)
					)
				) {
					flex: 1 1 0;
					min-height: 0;
				}
			}

			r4-listening-decks {
				overflow-y: visible;
				flex-direction: column;
				min-width: 0;

				/* sections with fill decks share the strip height */
				&:has(
					:global(
						r4-deck:not([compact='true']):is(
								:not([hide-video='true']),
								[listening='true'],
								[auto='true'],
								:not([listening='true']):not([auto='true']):not([hide-queue='true'])
							)
					)
				) {
					flex: 1 1 0;
					min-height: 0;
				}
			}

			/* deck-items: non-fill shrink but don't grow, fill items take available space */
			r4-deck-item {
				flex: 0 1 auto;
				min-height: 0;

				&:has(
					:global(
						r4-deck:not([compact='true']):is(
								:not([hide-video='true']),
								[listening='true'],
								[auto='true'],
								:not([listening='true']):not([auto='true']):not([hide-queue='true'])
							)
					)
				) {
					flex: 1 1 0;
				}
			}

			r4-deck-sync-bar {
				padding-top: var(--space-1);
			}

			/* One visible non-compact deck should fill height even when video is hidden */
			&[single-visible-noncompact='true'] {
				flex: 1 1 0;
				min-height: 100%;
			}

			&[single-visible-noncompact='true'] r4-deck-sections,
			&[single-visible-noncompact='true'] r4-local-decks,
			&[single-visible-noncompact='true'] r4-listening-decks,
			&[single-visible-noncompact='true'] r4-deck-item {
				flex: 1 1 0;
				min-height: 0;
			}

			&[single-visible-noncompact='true'] :global(r4-deck:not([compact='true'])) {
				height: 100%;
			}
		}
	}
</style>
