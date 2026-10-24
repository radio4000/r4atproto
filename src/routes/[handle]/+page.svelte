<script lang="ts">
	import {
		tracksCollection,
		loadTracksForDid,
		loadMoreTracksForDid,
		getPaginationState,
		removeTrack
	} from '#lib/stores/tracks-db.js'
	import {getContext, tick, onMount} from 'svelte'
	import {useLiveQuery} from '@tanstack/svelte-db'
	import TrackListItem from '#lib/components/TrackListItem.svelte'
	import TrackDetail from '#lib/components/TrackDetail.svelte'
	import TrackEditDialogContent from '#lib/components/TrackEditDialogContent.svelte'
	import Dialog from '#lib/components/ui/Dialog.svelte'
	import {session} from '#lib/state/session.js'
	import {Button} from '#lib/components/ui/button/index.js'
	import {Loader2, AlertCircle, RefreshCw} from 'lucide-svelte'
	import StateCard from '#lib/components/ui/state-card.svelte'
	import {locale, translate} from '#lib/i18n/index.js'
	import {browser} from '$app/environment'

	const {data} = $props()
	const handle = $derived(data?.handle ? data.handle.replace(/^@/, '') : '')

	// Get profile and did from layout context
	const profileContext = getContext('profile')
	const profile = $derived(profileContext?.profile)
	const did = $derived(profileContext?.did)

	let status = $state('')
	let loading = $state(false)
	let refreshing = $state(false)
	let loadingAll = $state(false)
	let loadProgress = $state({current: 0, total: 0})
	let viewingTrackUri = $state<string | null>(null)
	let editingTrackUri = $state<string | null>(null)
	let lastLoadedDid = $state<string>('')
	const context = $derived(
		did ? {type: 'author', key: did, handle} : {type: 'author', key: handle || ''}
	)
	const t = (key, vars = {}) => translate($locale, key, vars)
	let listContainer = $state<HTMLElement | null>(null)

	// Watch all tracks in the collection, then filter client-side
	// This is simpler and avoids the useLiveQuery filtering issues
	const allTracksQuery = useLiveQuery((q) => q.from({tracks: tracksCollection}), [])

	const items = $derived.by(() => {
		if (!did) {
			console.log('[Profile] No DID, returning empty tracks')
			return []
		}

		const allTracks = allTracksQuery.data || []
		console.log('[Profile] All tracks in collection:', allTracks.length)

		const filtered = allTracks.filter((track) => track.authorDid === did)
		console.log('[Profile] Filtered tracks for DID:', filtered.length, 'did:', did)

		// Sort by created_at descending (newest first)
		return filtered.sort((a, b) => {
			const dateA = new Date(a.created_at || 0).getTime()
			const dateB = new Date(b.created_at || 0).getTime()
			return dateB - dateA
		})
	})

	// Group tracks by Year Month based on created_at
	// Memoized with single pass for better performance
	const groupedTracksWithIndex = $derived.by(() => {
		const groups = new Map<string, {tracks: typeof items; year: number; month: number}>()
		const indexMap = new Map<string, number>()

		// Cache month formatter to avoid creating it for each track
		const monthFormatter = new Intl.DateTimeFormat($locale, {month: 'long'})

		// Single pass: build groups and index map
		items.forEach((track, index) => {
			indexMap.set(track.uri, index)

			const createdAt = track.created_at
			if (!createdAt) return

			try {
				const date = new Date(createdAt)
				if (isNaN(date.getTime())) return

				const year = date.getFullYear()
				const monthNum = date.getMonth() // 0-11
				const monthName = monthFormatter.format(date)
				const key = `${year} ${monthName}`

				if (!groups.has(key)) {
					groups.set(key, {tracks: [], year, month: monthNum})
				}
				groups.get(key)!.tracks.push(track)
			} catch (e) {
				// Invalid date, skip grouping
			}
		})

		// Sort groups by sortKey (descending), tracks within groups don't need sorting
		// since items are already sorted by created_at descending
		const sortedGroups = Array.from(groups.entries())
			.map(([key, data]) => ({
				key,
				tracks: data.tracks, // Don't re-sort, items already sorted
				year: data.year,
				month: data.month,
				sortKey: data.year * 100 + data.month
			}))
			.sort((a, b) => b.sortKey - a.sortKey)

		return {groups: sortedGroups, indexMap}
	})

	const groupedTracks = $derived(groupedTracksWithIndex.groups)
	const trackIndexMap = $derived(groupedTracksWithIndex.indexMap)

	let paginationState = $state<{cursor?: string; hasMore: boolean; loading: boolean}>({
		cursor: undefined,
		hasMore: false,
		loading: false
	})

	// Subscribe to pagination state changes
	$effect(() => {
		if (!did) {
			paginationState = {cursor: undefined, hasMore: false, loading: false}
			return
		}
		const store = getPaginationState(did)
		const unsubscribe = store.subscribe((value) => {
			paginationState = value
		})
		return () => unsubscribe()
	})

	const cursor = $derived(paginationState.cursor)
	const hasMore = $derived(paginationState.hasMore)

	const viewingTrack = $derived(items.find((t) => t.uri === viewingTrackUri) || null)
	const editingTrack = $derived(items.find((t) => t.uri === editingTrackUri) || null)
	const editingRkey = $derived(editingTrackUri ? editingTrackUri.split('/').pop() : '')
	const editable = $derived($session?.did && did && $session.did === did ? true : false)

	async function refreshTracks() {
		if (!did) return
		refreshing = true
		status = ''

		try {
			await loadTracksForDid(did, {forceRefresh: true, limit: 50})
		} catch (err) {
			status = (err as Error)?.message || String(err)
		} finally {
			refreshing = false
		}
	}

	async function loadTracks(targetDid: string) {
		// Check if we already have tracks for this DID in the collection
		const existingTracks = tracksCollection.toArray.filter((track) => track.authorDid === targetDid)
		console.log(
			'[Profile] loadTracks called for DID:',
			targetDid,
			'existing tracks:',
			existingTracks.length
		)

		// If we already have tracks, don't reload (useLiveQuery will automatically show them)
		if (existingTracks.length > 0) {
			console.log('[Profile] Found existing tracks, skipping load')
			return
		}

		loading = true
		status = ''

		try {
			console.log('[Profile] Loading tracks from API for DID:', targetDid)
			await loadTracksForDid(targetDid)
			console.log('[Profile] Tracks loaded')
		} catch (err) {
			status = (err as Error)?.message || String(err)
			console.error('[Profile] Error loading tracks:', err)
		} finally {
			loading = false
		}
	}

	$effect(() => {
		// Only load tracks when did actually changes, not on every reactive update
		if (did && did !== lastLoadedDid) {
			lastLoadedDid = did
			loadTracks(did)
		}
	})

	function selectTrack(trackUri: string) {
		viewingTrackUri = trackUri
	}

	function closeViewDialog() {
		viewingTrackUri = null
	}

	function openEditDialog(trackUri: string) {
		editingTrackUri = trackUri
	}

	function closeEditDialog() {
		editingTrackUri = null
	}

	function onTrackSaved() {
		closeEditDialog()
		// Refresh tracks to get updated data
		if (did) {
			refreshTracks()
		}
	}

	async function handleTrackRemoved(event) {
		const {uri} = event.detail
		try {
			await removeTrack(uri)
			// If the removed track was selected, clear selection
			if (selectedTrackUri === uri) {
				selectedTrackUri = null
			}
		} catch (err) {
			status = (err as Error)?.message || String(err)
		}
	}

	async function more() {
		if (!cursor || !did) return
		try {
			await loadMoreTracksForDid(did)
		} catch (err) {
			status = (err as Error)?.message || String(err)
		}
	}

	async function loadAll() {
		if (!did || loadingAll) return

		loadingAll = true
		status = ''

		try {
			// Keep loading while hasMore is true
			while (paginationState.hasMore && paginationState.cursor) {
				const beforeCount = items.length
				await loadMoreTracksForDid(did)

				// Update progress - show current count
				loadProgress = {current: items.length, total: items.length}

				// If no new tracks were loaded, break to avoid infinite loop
				if (items.length === beforeCount) {
					break
				}

				// Small delay to prevent overwhelming the API
				await new Promise((resolve) => setTimeout(resolve, 100))
			}

			loadProgress = {current: 0, total: 0}
		} catch (err) {
			status = (err as Error)?.message || String(err)
			loadProgress = {current: 0, total: 0}
		} finally {
			loadingAll = false
		}
	}

	// Handle infinite scroll
	function handleScroll(event: Event) {
		if (!hasMore || paginationState.loading || loadingAll) return

		const container = event.target as HTMLElement
		const {scrollTop, scrollHeight, clientHeight} = container

		// Load more when scrolled near bottom (within 300px)
		if (scrollHeight - scrollTop - clientHeight < 300) {
			more()
		}
	}
</script>

{#if status}
	<StateCard icon={AlertCircle} title={t('profile.errorTitle')} description={status} class="mb-6">
		{#snippet actions()}
			<Button variant="outline" onclick={refreshTracks}>
				{t('buttons.tryAgain')}
			</Button>
		{/snippet}
	</StateCard>
{/if}

{#if loading}
	<div class="flex items-center justify-center min-h-[50vh]">
		<StateCard
			icon={Loader2}
			loading={true}
			title={t('profile.loadingTitle')}
			description={t('profile.loadingDescription')}
		/>
	</div>
{:else if items.length}
	<div class="flex flex-col gap-3 flex-1 min-h-0">
		<div class="flex items-center justify-between gap-3 px-2">
			<div class="flex items-center gap-2">
				<span class="text-sm font-medium text-foreground">
					{items.length}
					{items.length === 1 ? t('profile.track') : t('profile.tracks')}
				</span>
			</div>
			<div class="flex items-center gap-2">
				<Button
					variant="outline"
					size="sm"
					onclick={refreshTracks}
					disabled={refreshing}
					title={t('profile.refresh') || 'Refresh'}
					class="gap-2"
				>
					<RefreshCw class={refreshing ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
					{#if refreshing}
						<span class="text-xs">{t('profile.refreshing')}</span>
					{/if}
				</Button>
				{#if hasMore || loadingAll}
					<Button
						variant="outline"
						size="sm"
						onclick={loadAll}
						disabled={loadingAll || paginationState.loading || !hasMore}
						class="gap-2"
					>
						{#if loadingAll}
							<Loader2 class="h-4 w-4 animate-spin" />
							<span>{loadProgress.current} {t('profile.loaded')}</span>
						{:else}
							{t('profile.loadAllTracks')}
						{/if}
					</Button>
				{/if}
			</div>
		</div>
		<div
			class="flex-1 min-h-0 overflow-auto space-y-3"
			role="region"
			aria-label="Track list grouped by date"
			bind:this={listContainer}
			onscroll={handleScroll}
		>
			{#each groupedTracks as group (group.key)}
				<div class="space-y-2">
					<h3 class="text-sm font-semibold text-foreground/80 uppercase tracking-wide px-2">
						{group.key}
						<span class="ml-2 text-xs font-normal text-muted-foreground">
							({group.tracks.length}
							{group.tracks.length === 1 ? t('profile.track') : t('profile.tracks')})
						</span>
					</h3>
					<div class="rounded-xl border border-border bg-card/70 overflow-hidden">
						{#each group.tracks as item (item.uri)}
							{@const globalIdx = trackIndexMap.get(item.uri) ?? 0}
							<TrackListItem
								{item}
								index={globalIdx}
								{items}
								{context}
								{editable}
								flat={true}
								onSelectTrack={selectTrack}
								onEditTrack={openEditDialog}
								onremove={handleTrackRemoved}
								showAuthor={false}
							/>
						{/each}
					</div>
				</div>
			{/each}
			{#if hasMore && paginationState.loading}
				<div class="flex items-center justify-center py-4">
					<div class="flex items-center gap-2 text-sm text-muted-foreground">
						<Loader2 class="h-4 w-4 animate-spin" />
						{t('profile.loading')}
					</div>
				</div>
			{/if}
		</div>
	</div>
{:else}
	<StateCard
		icon={AlertCircle}
		title={t('profile.noTracksTitle')}
		description={t('profile.noTracksDescription')}
	/>
{/if}

{#if editingTrackUri && editingRkey}
	<Dialog title={t('editTrack.title')} onClose={closeEditDialog}>
		<TrackEditDialogContent {handle} repo={did} rkey={editingRkey} onsaved={onTrackSaved} />
	</Dialog>
{/if}

{#if viewingTrackUri && viewingTrack}
	{@const viewingIndex = trackIndexMap.get(viewingTrackUri) ?? 0}
	{@const authorHandle =
		context?.handle || viewingTrack.authorHandle || viewingTrack.author_handle || handle}
	<Dialog
		title="{viewingTrack.title || t('trackItem.untitled')} (@{authorHandle})"
		onClose={closeViewDialog}
	>
		<TrackDetail track={viewingTrack} {handle} {items} index={viewingIndex} {context} {editable} />
	</Dialog>
{/if}
