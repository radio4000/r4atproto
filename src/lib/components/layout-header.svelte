<script>
	import {unreadChat} from '#lib/chat-unread.svelte.js'
	import {page} from '$app/state'
	import {onMount} from 'svelte'
	import {MediaQuery} from 'svelte/reactivity'
	import {appState} from '#lib/app-state.svelte.js'
	import Icon from '#lib/components/icon.svelte'
	import ChannelAvatar from '#lib/components/channel-avatar.svelte'
	import AddTrackDialog from '#lib/components/track-add-dialog.svelte'
	import BroadcastToggle from '#lib/components/broadcast-toggle.svelte'
	import {authHref, channelHref} from '#lib/links.js'
	import ui from '#lib/config/ui.json' with {type: 'json'}
	import * as m from '#lib/paraglide/messages.js'

	// Same layout decisions as r4-svelte's header: a vertical rail with labels to
	// the right on desktop, a bottom tab bar with labels below on mobile, icon-only
	// on the smallest phones. Double-click the background to hide the labels.
	const LABELS_STORAGE_KEY = 'r4:layout-header-labels-visible'
	const {conceptIcons: icons} = ui

	const mobile = new MediaQuery(`(max-width: ${ui.mobileBreakpoint}px)`)
	let labelsVisible = $state(true)
	const labels = $derived(labelsVisible ? (mobile.current ? 'below' : 'right') : 'none')

	const handle = $derived(appState.session?.handle)
	const path = $derived(page.url.pathname)

	/** aria-current for a nav link: exact match, or any sub page when `prefix` */
	function current(href, prefix = false) {
		const active = prefix ? path === href || path.startsWith(`${href}/`) : path === href
		return active ? 'page' : undefined
	}

	function toggleLabels(event) {
		if (event.target.closest('a, button, input')) return
		labelsVisible = !labelsVisible
		try {
			localStorage.setItem(LABELS_STORAGE_KEY, labelsVisible ? '1' : '0')
		} catch {
			// storage unavailable (private mode): labels stay visible
		}
	}

	onMount(() => {
		try {
			labelsVisible = localStorage.getItem(LABELS_STORAGE_KEY) !== '0'
		} catch {
			// storage unavailable (private mode): labels stay visible
		}
	})
</script>

<header data-labels={labels} ondblclick={toggleLabels}>
	<menu>
		<li>
			<a href="/" aria-current={current('/')} title={m.nav_home()}>
				<Icon icon={icons.home} />
				<span>{m.nav_home()}</span>
			</a>
		</li>
		<li>
			<a href="/explore" aria-current={current('/explore', true)} title={m.nav_explore()}>
				<Icon icon={icons.explore} />
				<span>{m.nav_explore()}</span>
			</a>
		</li>
	</menu>

	<menu>
		<li>
			<AddTrackDialog label={m.track_add_title()} />
		</li>
		{#if handle}
			<li>
				<BroadcastToggle label />
			</li>
			<li>
				<a
					href={channelHref(handle)}
					aria-current={current(channelHref(handle), true)}
					title={m.header_go_to_channel()}
				>
					<r4-header-avatar>
						<ChannelAvatar src={appState.channel?.image} alt={appState.channel?.name ?? handle} />
					</r4-header-avatar>
					<span>@{handle}</span>
					{#if appState.session && unreadChat[appState.session.did]}
						<mark title={m.chat_unread({count: unreadChat[appState.session.did]})}
							>{unreadChat[appState.session.did]}</mark
						>
					{/if}
				</a>
			</li>
		{:else}
			<li>
				<a href={authHref(path)} aria-current={current('/auth')} title={m.nav_sign_in()}>
					<Icon icon={icons.user} />
					<span>{m.nav_sign_in()}</span>
				</a>
			</li>
		{/if}
	</menu>

	<menu>
		<li>
			<a href="/settings" aria-current={current('/settings', true)} title={m.nav_settings()}>
				<Icon icon={icons.settings} />
				<span>{m.nav_settings()}</span>
			</a>
		</li>
	</menu>
</header>

<style>
	header {
		--nav-size: var(--header-nav-size);
		--nav-glyph: var(--header-glyph-size);
		display: flex;
		flex-flow: column nowrap;
		gap: var(--space-3);
		padding: var(--space-3) var(--space-2) var(--space-2);
		min-inline-size: min-content;
		background: var(--floating-bg);
		overflow-y: auto;
		scrollbar-width: thin;
		user-select: none;
	}

	menu {
		flex-flow: column nowrap;
		align-items: stretch;
		gap: var(--space-3);
	}

	li {
		display: grid;
	}

	/* The last group (settings) sits at the bottom of the rail */
	menu:last-child {
		margin-block-start: auto;
	}

	a,
	li > :global(button) {
		justify-content: flex-start;
		min-height: var(--nav-size);
		min-width: var(--nav-size);
		padding: 0 var(--space-2);
		background: var(--button-bg);
	}

	a[aria-current='page'] {
		border-color: transparent;
	}

	r4-header-avatar {
		display: block;
		width: var(--nav-glyph);
		height: var(--nav-glyph);
		flex-shrink: 0;
	}

	:is(a, button) :global(svg) {
		width: var(--nav-glyph);
		height: var(--nav-glyph);
	}

	span,
	li > :global(button span) {
		font-size: var(--font-3);
		max-width: var(--header-label-width);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	[data-labels='none'] {
		span,
		:global(button span) {
			display: none;
		}

		a,
		li > :global(button) {
			justify-content: center;
			width: var(--nav-size);
		}
	}

	[data-labels='below'] :is(a, li > :global(button)) {
		flex-direction: column;
		justify-content: center;
		gap: 0;
	}

	@media (max-width: 768px) {
		header {
			--nav-size: var(--header-nav-size-mobile);
			flex-direction: row;
			align-items: center;
			justify-content: space-between;
			gap: var(--space-2);
			padding: var(--space-1) var(--space-2);
			overflow: visible;
		}

		menu {
			flex-direction: row;
		}

		menu:last-child {
			margin: 0;
		}

		span {
			font-size: var(--font-1);
		}
	}

	/* Smallest phones: icons only, across the whole bar */
	@media (max-width: 520px) {
		span,
		li > :global(button span) {
			display: none;
		}
	}
</style>
