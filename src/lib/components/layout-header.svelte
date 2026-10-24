<script>
	import {page} from '$app/state'
	import {onMount} from 'svelte'
	import {MediaQuery} from 'svelte/reactivity'
	import {session} from '#lib/state/session.js'
	import Icon from '#lib/components/icon.svelte'
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

	const handle = $derived($session?.handle)
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
		} catch {}
	}

	onMount(() => {
		try {
			labelsVisible = localStorage.getItem(LABELS_STORAGE_KEY) !== '0'
		} catch {}
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
			<a href="/add" aria-current={current('/add')} title={m.track_add_title()}>
				<Icon icon={icons.add} />
				<span>{m.track_add_title()}</span>
			</a>
		</li>
		{#if handle}
			<li>
				<a
					href={`/@${handle}`}
					aria-current={current(`/@${handle}`, true)}
					title={m.header_go_to_channel()}
				>
					<Icon icon={icons.user} />
					<span>@{handle}</span>
				</a>
			</li>
		{:else}
			<li>
				<a
					href="/settings/account"
					aria-current={current('/settings/account')}
					title={m.nav_sign_in()}
				>
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

	a {
		justify-content: flex-start;
		min-height: var(--nav-size);
		min-width: var(--nav-size);
		padding: 0 var(--space-2);
		background: var(--button-bg);
	}

	a[aria-current='page'] {
		border-color: transparent;
	}

	a :global(svg) {
		width: var(--nav-glyph);
		height: var(--nav-glyph);
	}

	span {
		font-size: var(--font-3);
		max-width: var(--header-label-width);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	[data-labels='none'] {
		span {
			display: none;
		}

		a {
			justify-content: center;
			width: var(--nav-size);
		}
	}

	[data-labels='below'] a {
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
		span {
			display: none;
		}
	}
</style>
