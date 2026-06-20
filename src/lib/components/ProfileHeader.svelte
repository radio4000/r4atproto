<script lang="ts">
	import Avatar from './Avatar.svelte'
	import { Card, CardHeader, CardTitle, CardDescription } from './ui/card'
	import { Button, buttonVariants } from './ui/button'
	import { cn, menuItemClass, menuTriggerClass } from '$lib/utils'
	import Link from '$lib/components/Link.svelte'
	import Dialog from '$lib/components/ui/Dialog.svelte'
	import { PlayCircle, Loader2, MoreVertical, ExternalLink, Copy, Eye, Star, Maximize2 } from 'lucide-svelte'
	import {
		resolveHandle,
		listTracksByDid,
		createR4Favorite,
		deleteR4Favorite,
		findR4FavoriteUri,
	} from '$lib/services/r4-service'
	import { setPlaylist, player } from '$lib/player/store'
	import { onMount, onDestroy } from 'svelte'
	import { locale, translate } from '$lib/i18n'
	import { session } from '$lib/state/session'

	const {
		profile,
		handle,
		size = 'lg',
		class: extraClass = '',
		clickable = true,
		children,
	} = $props()

	const t = (key, vars = {}) => translate($locale, key, vars)

	const sizeMap = {
		sm: { avatar: 'md', title: 'text-xl', description: 'text-sm' },
		md: { avatar: 'lg', title: 'text-2xl', description: 'text-base' },
		lg: { avatar: 'xl', title: 'text-3xl', description: 'text-base' },
	}

	const sizes = sizeMap[size] || sizeMap.lg

	let loadingTracks = $state(false)
	let playerState = $state(player.get())
	const unsubscribe = player.subscribe((value) => {
		playerState = value
	})
	onDestroy(() => unsubscribe?.())

	let menuOpen = $state(false)
	let menuRef = $state<HTMLElement | null>(null)
	let triggerRef = $state<HTMLElement | null>(null)
	let menuPosition = $state<{ top: number; right: number } | null>(null)

	const normalizedHandle = $derived(handle?.replace(/^@/, '') ?? '')
	const currentHandle = $derived.by(() => {
		const contextHandle = playerState?.context?.handle
		const trackHandle =
			playerState?.playlist?.[playerState.index]?.authorHandle ??
			playerState?.playlist?.[playerState.index]?.author_handle
		const raw = contextHandle || trackHandle || ''
		return raw?.replace?.(/^@/, '') ?? ''
	})
	const isActiveProfile = $derived.by(() =>
		normalizedHandle && currentHandle
			? normalizedHandle.toLowerCase() === currentHandle.toLowerCase()
			: false,
	)

	const hasBanner = $derived(!!profile?.banner)

	async function playAll(event?: Event) {
		event?.preventDefault()
		event?.stopPropagation()

		if (loadingTracks) return
		loadingTracks = true

		try {
			const did = await resolveHandle(handle)
			const { tracks } = await listTracksByDid(did)

			if (tracks.length > 0) {
				setPlaylist(tracks, 0, { type: 'profile', key: did, handle: normalizedHandle })
			}
		} catch (err) {
			console.error('Failed to load tracks:', err)
		} finally {
			loadingTracks = false
		}
	}

	function toggleMenu(event?: MouseEvent) {
		if (menuOpen) {
			menuOpen = false
			menuPosition = null
			return
		}

		menuOpen = true

		// Calculate menu position relative to viewport using the actual button element
		const button = (event?.currentTarget || triggerRef) as HTMLElement
		if (button) {
			const rect = button.getBoundingClientRect()
			// Position menu aligned to the right edge of the button
			// Account for menu width (192px = w-48) to ensure it doesn't go off-screen
			const menuWidth = 192
			let rightPos = window.innerWidth - rect.right

			// If menu would go off left edge, adjust to align with button's left edge instead
			if (rect.right - menuWidth < 0) {
				rightPos = window.innerWidth - rect.left - menuWidth
			}

			menuPosition = {
				top: rect.bottom + 6, // 6px gap below trigger
				right: rightPos
			}
		}
	}

	function closeMenu() {
		menuOpen = false
		menuPosition = null
	}

	function copyProfileUrl() {
		const url = window.location.origin + `/@${normalizedHandle}`
		navigator.clipboard.writeText(url)
		closeMenu()
	}

	// Favorite functionality
	let favoriteUri = $state<string | null>(null)
	let favoriteLoading = $state(false)
	let profileDid = $state<string | null>(null)
	let imageDialogOpen = $state(false)
	let imageDialogSrc = $state('')
	let imageDialogTitle = $state('')

	async function refreshFavoriteState() {
		if (!handle || !$session?.did) {
			favoriteUri = null
			return
		}
		try {
			const did = await resolveHandle(handle)
			profileDid = did
			favoriteUri = await findR4FavoriteUri(did)
		} catch (err) {
			console.error('Failed to load favorite state:', err)
		}
	}

	async function toggleFavorite() {
		if (!$session?.did || !profileDid) return
		favoriteLoading = true
		try {
			if (favoriteUri) {
				await deleteR4Favorite(profileDid)
				favoriteUri = null
			} else {
				const res = await createR4Favorite(profileDid)
				favoriteUri = res?.uri || (await findR4FavoriteUri(profileDid))
			}
			await refreshFavoriteState()
		} catch (err) {
			console.error('Failed to toggle favorite:', err)
		} finally {
			favoriteLoading = false
		}
		closeMenu()
	}

	$effect(() => {
		refreshFavoriteState()
	})

	function openAvatarDialog(event: MouseEvent) {
		event.preventDefault()
		event.stopPropagation()
		if (profile?.avatar || profile?.banner) {
			imageDialogSrc = profile.avatar || profile.banner
			imageDialogTitle = `${profile?.displayName || handle}`
			imageDialogOpen = true
		}
	}

	function openBannerDialog(event: MouseEvent) {
		event.preventDefault()
		event.stopPropagation()
		if (profile?.banner) {
			imageDialogSrc = profile.banner
			imageDialogTitle = `${profile?.displayName || handle}`
			imageDialogOpen = true
		}
	}

	function closeImageDialog() {
		imageDialogOpen = false
		imageDialogSrc = ''
		imageDialogTitle = ''
	}

	onMount(() => {
		function handleClick(event: MouseEvent) {
			if (!menuOpen) return
			const target = event.target as Node
			if (menuRef && menuRef.contains(target)) return
			if (triggerRef && triggerRef.contains(target)) return
			menuOpen = false
		}
		function handleKey(event: KeyboardEvent) {
			if (event.key === 'Escape') menuOpen = false
		}
		window.addEventListener('click', handleClick)
		window.addEventListener('keydown', handleKey)
		return () => {
			window.removeEventListener('click', handleClick)
			window.removeEventListener('keydown', handleKey)
		}
	})
</script>

<Card
	class={cn(
		'border border-border bg-card animate-in transition-colors shadow-sm hover:bg-muted/20 relative',
		extraClass,
	)}
>
	{#if hasBanner}
		<button
			type="button"
			class="absolute inset-0 bg-cover bg-center cursor-pointer hover:opacity-95 transition-opacity z-0"
			style={`background-image: url(${profile.banner})`}
			onclick={openBannerDialog}
			title="Click to view banner"
			aria-label="View banner in full size"
		></button>
	{/if}
	<CardHeader class={cn('p-2.5 relative z-10')}>
		<div class="flex items-center justify-between gap-3">
			{#if clickable}
				<div class="flex items-center gap-3 min-w-0 flex-1">
					<button
						type="button"
						onclick={openAvatarDialog}
						class="shrink-0 hover:opacity-80 transition-opacity cursor-pointer"
						title="Click to view avatar in full size"
					>
						<Avatar src={profile?.avatar} alt={profile?.displayName || handle} size={sizes.avatar} />
					</button>
					<div class="min-w-0 flex-1">
						<CardTitle class={cn('flex items-center gap-2', sizes.title)}>
							<Link
								href={`/@${handle}`}
								class="hover:opacity-80 transition-opacity"
							>
								<span
									class={cn(
										'inline-block px-1 py-0.5 rounded transition-colors bg-background',
										isActiveProfile ? 'is-active' : '',
									)}
								>
									{profile?.displayName || handle}
								</span>
							</Link>
						</CardTitle>
						<CardDescription class={cn(sizes.description, 'mt-0')}>
							<Link
								href={`/@${handle}`}
								class="hover:opacity-80 transition-opacity"
							>
								<span
									class={cn(
										'inline-block px-1 py-0.5 rounded transition-colors bg-background',
										isActiveProfile ? 'is-active' : '',
									)}
								>
									@{handle}
								</span>
							</Link>
						</CardDescription>
						{#if profile?.description && size === 'lg'}
							<p class="text-sm px-1 py-0.5 rounded bg-background text-muted-foreground mt-2 max-w-xl">
								{profile.description}
							</p>
						{/if}
					</div>
				</div>
			{:else}
				<div class="flex items-center gap-3 min-w-0 flex-1">
					<button
						type="button"
						onclick={openAvatarDialog}
						class="shrink-0 hover:opacity-80 transition-opacity cursor-pointer"
						title="Click to view avatar in full size"
					>
						<Avatar src={profile?.avatar} alt={profile?.displayName || handle} size={sizes.avatar} />
					</button>
					<div class="min-w-0 flex-1">
						<CardTitle class={cn('flex items-center gap-2', sizes.title)}>
							<span
								class={cn(
									'inline-block px-1 py-0.5 rounded transition-colors bg-background',
									isActiveProfile ? 'is-active' : '',
								)}
							>
								{profile?.displayName || handle}
							</span>
						</CardTitle>
						<CardDescription class={cn(sizes.description, 'mt-0')}>
							<Link
								href={`/@${handle}`}
								class="hover:opacity-80 transition-opacity"
							>
								<span
									class={cn(
										'inline-block px-1 py-0.5 rounded transition-colors bg-background',
										isActiveProfile ? 'is-active' : '',
									)}
								>
									@{handle}
								</span>
							</Link>
						</CardDescription>
						{#if profile?.description && size === 'lg'}
							<p class="text-sm px-1 py-0.5 rounded bg-background text-muted-foreground mt-2 max-w-xl">
								{profile.description}
							</p>
						{/if}
					</div>
				</div>
			{/if}

			<div class="flex gap-2 items-center shrink-0">
				{#if children}
					{@render children()}
				{/if}

				<div class="flex flex-col gap-1 ml-auto">
					<button
						bind:this={triggerRef}
						type="button"
						class={cn(menuTriggerClass(menuOpen), 'h-9 w-9')}
						onclick={(e) => toggleMenu(e)}
						aria-haspopup="menu"
						aria-expanded={menuOpen}
						title={t('profile.actions')}
						aria-label={t('profile.actions')}
					>
						<MoreVertical class="h-4 w-4 text-current" />
					</button>
					{#if size === 'lg' && $session?.did && profileDid && $session.did !== profileDid}
						<button
							type="button"
							class={cn(menuTriggerClass(false), 'h-9 w-9', favoriteLoading && 'opacity-50 pointer-events-none')}
							onclick={toggleFavorite}
							disabled={favoriteLoading}
							title={favoriteUri ? 'Unfavorite' : 'Favorite'}
							aria-label={favoriteUri ? 'Unfavorite' : 'Favorite'}
						>
							{#if favoriteLoading}
								<Loader2 class="h-4 w-4 animate-spin text-current" />
							{:else if favoriteUri}
								<Star class="h-4 w-4 text-current fill-current" />
							{:else}
								<Star class="h-4 w-4 text-current" />
							{/if}
						</button>
					{/if}
				</div>
			</div>
		</div>
	</CardHeader>
</Card>

<!-- Menu portal - rendered outside card with fixed positioning -->
{#if menuOpen && menuPosition}
	<div
		bind:this={menuRef}
		class="fixed z-[100] w-48 rounded-md border border-foreground bg-background text-foreground shadow-lg"
		style={`top: ${menuPosition.top}px; right: ${menuPosition.right}px;`}
		role="menu"
	>
							<button
								type="button"
								class={cn(menuItemClass, loadingTracks && 'opacity-50 pointer-events-none')}
								onclick={() => {
									playAll();
									closeMenu();
								}}
								disabled={loadingTracks || isActiveProfile}
							>
								{#if loadingTracks}
									<Loader2 class="h-4 w-4 animate-spin" />
								{:else if isActiveProfile}
									<PlayCircle class="h-4 w-4" />
								{:else}
									<PlayCircle class="h-4 w-4" />
								{/if}
								{t('trackItem.play')}
							</button>
							{#if $session?.did}
								<button
									type="button"
									class={cn(menuItemClass, favoriteLoading && 'opacity-50 pointer-events-none')}
									onclick={toggleFavorite}
									disabled={favoriteLoading}
								>
									{#if favoriteLoading}
										<Loader2 class="h-4 w-4 animate-spin" />
									{:else if favoriteUri}
										<Star class="h-4 w-4 fill-current" />
									{:else}
										<Star class="h-4 w-4" />
									{/if}
									{favoriteUri ? 'Unfavorite' : 'Favorite'}
								</button>
							{/if}
							<a href={`/@${normalizedHandle}`} class={menuItemClass} onclick={closeMenu}>
								<Eye class="h-4 w-4" />
								{t('profile.viewProfile')}
							</a>
							<a
								href={`https://bsky.app/profile/${normalizedHandle}`}
								target="_blank"
								rel="noopener noreferrer"
								class={menuItemClass}
								onclick={closeMenu}
							>
								<ExternalLink class="h-4 w-4" />
								{t('profile.openInBluesky')}
							</a>
			<button type="button" class={menuItemClass} onclick={copyProfileUrl}>
				<Copy class="h-4 w-4" />
				{t('profile.copyLink')}
			</button>
		</div>
	{/if}

{#if imageDialogOpen}
	<Dialog title={imageDialogTitle} onClose={closeImageDialog}>
		<div class="flex flex-col gap-4">
			{#if profile?.banner}
				<div class="flex items-center justify-center">
					<img
						src={profile.banner}
						alt={`${imageDialogTitle} cover`}
						class="max-w-full max-h-[40vh] object-contain"
					/>
				</div>
			{/if}
			{#if profile?.avatar}
				<div class="flex items-center justify-center">
					<img
						src={profile.avatar}
						alt={`${imageDialogTitle} profile`}
						class="max-w-full max-h-[40vh] object-contain"
					/>
				</div>
			{/if}
		</div>
	</Dialog>
{/if}
