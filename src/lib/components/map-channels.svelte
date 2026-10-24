<script>
	import {goto} from '$app/navigation'
	import * as maplibregl from 'maplibre-gl'
	/** @import { GeoJSONSource } from 'maplibre-gl' */
	import {mount, onDestroy, unmount} from 'svelte'
	import MapComponent from './map.svelte'
	import ChannelCard from './channel-card.svelte'
	import Icon from './icon.svelte'
	import {BroadcastLayer} from './map-broadcast-layer.js'
	import {getChannelActivity} from '#lib/channel-activity.svelte.js'
	import ui from '#lib/config/ui.json' with {type: 'json'}
	import {resolveCssColor} from './map-color.js'
	import {buildChannelsGeoJSON, getLatestChannel} from './map-markers.js'
	import {swapBaseTiles} from './map-tile-styles.js'
	import {setupOverlays, updateNightLayer as writeNightLayerData} from './map-overlays.js'
	import * as m from '#lib/paraglide/messages.js'
	const channelActivity = $derived(getChannelActivity())

	/** @type {{channels?: import('#lib/types.js').Channel[], loading?: boolean, latitude?: number|null, longitude?: number|null, zoom?: number|null, syncUrl?: boolean, openSlug?: string|null, openRequestKey?: string|null, showControls?: boolean, globeMode?: boolean, showGraticules?: boolean, showDayNight?: boolean, tileStyle?: 'osm' | 'topo' | 'satellite'}} */
	let {
		channels = [],
		loading = false,
		latitude = null,
		longitude = null,
		zoom = null,
		syncUrl = true,
		openSlug = null,
		openRequestKey = null,
		showControls = true,
		globeMode = $bindable(false),
		showGraticules = $bindable(ui.map.showGraticules),
		showDayNight = $bindable(ui.map.showDayNight),
		tileStyle = $bindable(/** @type {'osm' | 'topo' | 'satellite'} */ (ui.map.defaultTileStyle))
	} = $props()

	/** @type {maplibregl.Map | null} */
	let map = $state(null)
	let mapReady = $state(false)
	/** @type {BroadcastLayer | null} */
	let broadcastLayer = null
	let popupNavigationInFlight = false
	/** @type {ReturnType<typeof setTimeout> | null} */
	let pendingPopupLinkNavigationTimer = null
	/** @type {string | null} */
	let lastAutoOpenedToken = null
	/** @type {ReturnType<typeof setTimeout> | null} */
	let autoOpenRetryTimer = null
	let stickyPopupSlug = null
	let stickyPopupUntil = 0
	/** @type {Array<() => void>} */
	let popupCleanupFns = []
	/** @type {maplibregl.Popup | null} */
	let currentPopup = null
	const favoriteIds = $derived(channelActivity.favoriteChannelIds)
	const broadcastingIds = $derived(channelActivity.broadcastingChannelIds)
	const playingSlugs = $derived(channelActivity.playingChannelSlugs)
	const inDeckSlugs = $derived(channelActivity.inDeckChannelSlugs)
	const mapChannels = $derived.by(() => {
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- rebuilt inside $derived.by, no mutation after creation
		const byId = new Map()
		for (const channel of channels) {
			const lat = Number(channel?.latitude)
			const lng = Number(channel?.longitude)
			if (
				!channel ||
				typeof channel.id !== 'string' ||
				typeof channel.slug !== 'string' ||
				!Number.isFinite(lat) ||
				!Number.isFinite(lng)
			)
				continue
			if (!byId.has(channel.id)) byId.set(channel.id, {...channel, latitude: lat, longitude: lng})
		}
		return [...byId.values()]
	})
	// GeoJSON derived from channel data, activity and palette — the map-ready
	// effect below writes it into the source whenever any of those change.
	const cachedGeoJSON = $derived.by(() => {
		if (loading) return null
		return buildChannelsGeoJSON(
			mapChannels,
			{favoriteIds, broadcastingIds, playingSlugs, inDeckSlugs},
			palette
		)
	})

	const palette = $derived.by(() => ({
		// Fixed dark charcoal, not a theme var: tiles like topo/satellite are always
		// light-ish regardless of app theme, and a dark fill inside the white ring
		// maximises internal contrast so the marker reads on any background.
		normalFill: 'rgb(45, 45, 52)',
		favoriteFill: resolveCssColor('--accent-6'),
		favoriteBroadcastFill: resolveCssColor('--accent-6'),
		activeFill: resolveCssColor('--accent-9'),
		// broadcasting: light accent fill (same var as channel-card's .playing bg)
		broadcastingFill: resolveCssColor('--accent-3'),
		// stroke vars below feed the broadcast ring (broadcastRingColor), not the marker outline
		favoriteBroadcastStroke: resolveCssColor('--accent-11'),
		broadcastingStroke: resolveCssColor('--accent-11')
	}))

	/** @returns {any} */
	function broadcastRingLayer() {
		return {
			id: 'channels-broadcast-ring',
			type: 'circle',
			source: 'channels-source',
			filter: ['==', ['get', 'isBroadcasting'], true],
			paint: {
				'circle-radius': ['+', ['get', 'radius'], 8],
				'circle-color': 'rgba(0, 0, 0, 0)',
				'circle-stroke-color': ['get', 'broadcastRingColor'],
				'circle-stroke-width': ['case', ['==', ['get', 'isFavorite'], true], 3.5, 2.5],
				'circle-opacity': 0.9,
				'circle-blur': 0.1
			}
		}
	}

	/** @param {maplibregl.Map} m @param {any} fc */
	function setupLayers(m, fc) {
		if (!m || !fc) return
		if (!m.getSource('channels-source')) {
			m.addSource('channels-source', {type: 'geojson', data: fc})
			m.addLayer(broadcastRingLayer())
			// Soft dark shadow beneath each marker — the "dark" half of the
			// light+dark contrast combo, so markers read on pale tiles too.
			m.addLayer({
				id: 'channels-shadow',
				type: 'circle',
				source: 'channels-source',
				paint: {
					'circle-radius': ['+', ['get', 'radius'], 3],
					'circle-color': 'rgba(0, 0, 0, 0.55)',
					'circle-blur': 0.6,
					'circle-opacity': 0.7
				}
			})
			m.addLayer({
				id: 'channels-layer',
				type: 'circle',
				source: 'channels-source',
				paint: {
					'circle-radius': ['get', 'radius'],
					'circle-color': ['get', 'fillColor'],
					// White ring — the "light" half, pops on dark/satellite tiles.
					'circle-stroke-color': 'rgb(255, 255, 255)',
					'circle-stroke-width': ['get', 'strokeWidth'],
					'circle-opacity': 1
				}
			})

			m.on('click', 'channels-layer', (e) => {
				if (!e.features?.length) return
				const feature = e.features[0]
				const slug = feature.properties?.slug
				if (!slug) return
				const channel = mapChannels.find((c) => c.slug === slug)
				if (!channel) return
				const geom = /** @type {GeoJSON.Point} */ (feature.geometry)
				openPopupForChannel(channel, geom.coordinates)
				stickyPopupSlug = slug
			})

			m.on('mouseenter', 'channels-layer', () => {
				m.getCanvas().style.cursor = 'pointer'
			})
			m.on('mouseleave', 'channels-layer', () => {
				m.getCanvas().style.cursor = ''
			})
		} else {
			const source = /** @type {GeoJSONSource | undefined} */ (m.getSource('channels-source'))
			source?.setData(fc)
			if (!m.getLayer('channels-broadcast-ring')) m.addLayer(broadcastRingLayer())
		}
	}

	function openPopupForChannel(channel, coordinates) {
		if (currentPopup) {
			currentPopup.remove()
			currentPopup = null
		}
		for (const cleanup of popupCleanupFns) cleanup()
		popupCleanupFns = []

		const container = document.createElement('r4-map-popup')

		/** @type {ReturnType<typeof mount> | null} */
		let mountedCard = null
		let keepPopupOpenUntil = 0

		const currentChannel = getLatestChannel(channel)
		mountedCard = mount(ChannelCard, {
			target: container,
			props: {channel: currentChannel}
		})

		const onPopupClick = (event) => {
			const target =
				event.target instanceof Element
					? event.target
					: event.target instanceof Node
						? event.target.parentElement
						: null
			if (!target) return
			if (target.closest('.maplibregl-popup-close-button')) return
			const clickedButton = target.closest('button, [role="button"]')
			if (clickedButton) {
				keepPopupOpenUntil = Date.now() + 3000
				stickyPopupSlug = channel.slug
				stickyPopupUntil = keepPopupOpenUntil
			}
			const link = target.closest('a[href]')
			if (link instanceof HTMLAnchorElement) {
				event.preventDefault()
				event.stopPropagation()
				if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation()
				if (event.detail > 1) {
					clearPendingPopupLinkNavigation()
					return
				}
				const href = link.getAttribute('href')
				if (!href) return
				if (href.startsWith('#')) return
				if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('//'))
					return
				if (popupNavigationInFlight) return
				clearPendingPopupLinkNavigation()
				pendingPopupLinkNavigationTimer = setTimeout(() => {
					pendingPopupLinkNavigationTimer = null
					if (popupNavigationInFlight) return
					popupNavigationInFlight = true
					setTimeout(() => {
						popupNavigationInFlight = false
					}, 450)
					void goto(href)
				}, 280)
				return
			}
			if (event.detail === 2) {
				keepPopupOpenUntil = Date.now() + 3000
				stickyPopupSlug = channel.slug
				stickyPopupUntil = keepPopupOpenUntil
			}
		}

		container.addEventListener('click', onPopupClick, true)

		const popup = new maplibregl.Popup({closeButton: true, maxWidth: 'none'})
			.setLngLat(coordinates)
			.setDOMContent(container)
			.addTo(/** @type {maplibregl.Map} */ (map))

		popup.on('close', () => {
			if (Date.now() < keepPopupOpenUntil && map) {
				requestAnimationFrame(() => {
					if (!map) return
					const channel2 = mapChannels.find((c) => c.slug === stickyPopupSlug)
					if (channel2) openPopupForChannel(channel2, [channel2.longitude, channel2.latitude])
				})
			} else {
				currentPopup = null
			}
		})

		popupCleanupFns.push(() => {
			container.removeEventListener('click', onPopupClick, true)
			if (mountedCard) {
				try {
					void unmount(mountedCard)
				} catch {
					// ignore teardown races
				}
				mountedCard = null
			}
		})

		currentPopup = popup
	}

	function updateBroadcastLayer() {
		if (!broadcastLayer || !mapReady) return
		broadcastLayer.setChannels(
			mapChannels
				.filter((c) => broadcastingIds.has(c.id))
				.map((c) => ({
					id: c.id,
					lng: c.longitude,
					lat: c.latitude,
					variant: favoriteIds.has(c.id) ? 'favorite_broadcasting' : 'broadcasting'
				}))
		)
	}

	function updateNightLayer() {
		if (!map || !mapReady) return
		writeNightLayerData(map)
	}

	function handleReady(m) {
		map = m
		setupOverlays(m, {showGraticules, showDayNight})
		if (!broadcastLayer) broadcastLayer = new BroadcastLayer()
		if (!m.getLayer('broadcast-3d')) m.addLayer(/** @type {any} */ (broadcastLayer))
		updateBroadcastLayer()
		mapReady = true // triggers the map-ready effect below
		maybeAutoOpenSlug(openSlug, openRequestKey)
	}

	function clearAutoOpenRetry() {
		if (autoOpenRetryTimer) {
			clearTimeout(autoOpenRetryTimer)
			autoOpenRetryTimer = null
		}
	}

	function clearPendingPopupLinkNavigation() {
		if (pendingPopupLinkNavigationTimer) {
			clearTimeout(pendingPopupLinkNavigationTimer)
			pendingPopupLinkNavigationTimer = null
		}
	}

	/**
	 * @param {string | null | undefined} slug
	 * @param {string | null | undefined} requestKey
	 * @param {number} [attempt]
	 */
	function maybeAutoOpenSlug(slug, requestKey, attempt = 0) {
		if (!slug || !map || !mapReady) return
		const token = `${requestKey ?? ''}|${slug}`
		if (token === lastAutoOpenedToken) return
		const channel = mapChannels.find((c) => c.slug === slug)
		if (channel) {
			const targetZoom = Math.max(map.getZoom(), map.getMinZoom())
			map.setCenter([channel.longitude, channel.latitude])
			map.setZoom(targetZoom)
			requestAnimationFrame(() => {
				if (!map) return
				openPopupForChannel(channel, [channel.longitude, channel.latitude])
				lastAutoOpenedToken = token
				clearAutoOpenRetry()
			})
			return
		}
		if (attempt >= 40) return
		clearAutoOpenRetry()
		autoOpenRetryTimer = setTimeout(() => {
			autoOpenRetryTimer = null
			maybeAutoOpenSlug(slug, requestKey, attempt + 1)
		}, 120)
	}

	// Render markers when map is ready AND data is available.
	// setupLayers is idempotent (creates source on first call, updates on subsequent).
	$effect(() => {
		const fc = cachedGeoJSON
		const m = map
		const ready = mapReady
		if (!m || !ready || !fc) return
		setupLayers(m, fc)
		// Restore sticky popup after data refresh
		if (Date.now() < stickyPopupUntil && stickyPopupSlug) {
			const slug = stickyPopupSlug
			requestAnimationFrame(() => {
				const channel = mapChannels.find((c) => c.slug === slug)
				if (channel) openPopupForChannel(channel, [channel.longitude, channel.latitude])
			})
		}
	})

	$effect(() => {
		void broadcastingIds
		void mapChannels
		updateBroadcastLayer()
	})

	$effect(() => {
		if (!openSlug) {
			lastAutoOpenedToken = null
			clearAutoOpenRetry()
			return
		}
		maybeAutoOpenSlug(openSlug, openRequestKey)
	})

	$effect(() => {
		if (!map || !mapReady) return
		map.setProjection({type: globeMode ? 'globe' : 'mercator'})
	})

	// Tile style switcher: swap just the base raster layer (see swapBaseTiles).
	$effect(() => {
		const style = tileStyle
		if (!map || !mapReady) return
		swapBaseTiles(map, style)
	})

	// Graticule visibility toggle
	$effect(() => {
		const vis = showGraticules ? 'visible' : 'none'
		if (!map || !mapReady) return
		if (map.getLayer('graticule-equator'))
			map.setLayoutProperty('graticule-equator', 'visibility', vis)
		if (map.getLayer('graticule-other')) map.setLayoutProperty('graticule-other', 'visibility', vis)
	})

	// Day/night visibility + 1-min update timer
	$effect(() => {
		const vis = showDayNight ? 'visible' : 'none'
		if (!map || !mapReady) return
		if (map.getLayer('night-layer')) map.setLayoutProperty('night-layer', 'visibility', vis)
		if (!showDayNight) return
		updateNightLayer()
		const id = setInterval(updateNightLayer, 60_000)
		return () => clearInterval(id)
	})

	onDestroy(() => {
		clearAutoOpenRetry()
		clearPendingPopupLinkNavigation()
		for (const cleanup of popupCleanupFns) cleanup()
		popupCleanupFns = []
		if (currentPopup) {
			currentPopup.remove()
			currentPopup = null
		}
	})
</script>

<r4-map-channels>
	<MapComponent onready={handleReady} {latitude} {longitude} {zoom} {syncUrl} />
	{#if loading}
		<r4-map-loading role="status">{m.common_loading()}</r4-map-loading>
	{/if}
	{#if showControls}
		<menu>
			<li>
				<button
					type="button"
					aria-pressed={globeMode}
					onclick={() => (globeMode = !globeMode)}
					title={globeMode ? m.map_switch_to_flat() : m.map_switch_to_globe()}
				>
					<Icon icon={globeMode ? 'map' : 'globe'} />
				</button>
			</li>
			<li>
				<button
					type="button"
					aria-pressed={showGraticules}
					onclick={() => (showGraticules = !showGraticules)}
					title={m.map_toggle_graticules()}
				>
					<Icon icon="grid" />
				</button>
			</li>
			<li>
				<button
					type="button"
					aria-pressed={showDayNight}
					onclick={() => (showDayNight = !showDayNight)}
					title={m.map_toggle_day_night()}
				>
					<Icon icon="sun" />
				</button>
			</li>
			<li>
				<select bind:value={tileStyle} title={m.map_tiles_label()} aria-label={m.map_tiles_label()}>
					<option value="osm">{m.map_tiles_map()}</option>
					<option value="topo">{m.map_tiles_topo()}</option>
					<option value="satellite">{m.map_tiles_satellite()}</option>
				</select>
			</li>
		</menu>
	{/if}
</r4-map-channels>

<style>
	r4-map-channels {
		display: flex;
		flex: 1;
		min-height: 0;
		height: 100%;
		position: relative;

		> menu {
			position: absolute;
			bottom: var(--space-2);
			left: var(--space-2);
			z-index: 10;
		}
	}

	r4-map-loading {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		background: var(--gray-1);
		padding: var(--space-2) var(--space-3);
		border-radius: var(--border-radius);
		font-size: var(--font-3);
		pointer-events: none;
		z-index: 10;
	}

	:global(.maplibregl-map) {
		font-family: var(--font-sans);
	}

	:global(r4-map-popup) {
		display: block;
		width: var(--map-popup-width);
	}

	:global(.maplibregl-popup-content) {
		padding: 0;
		background: var(--gray-1);
		color: var(--gray-12);
		box-shadow: var(--shadow-modal);
		border-radius: var(--border-radius);
	}

	:global(.maplibregl-popup-tip) {
		border-top-color: var(--gray-1);
		border-bottom-color: var(--gray-1);
	}

	:global(.maplibregl-popup-close-button) {
		top: var(--space-1);
		right: var(--space-1);
		width: 1.75rem;
		height: 1.75rem;
		min-width: 0;
		min-height: 0;
		padding: 0;
		z-index: 2;
		border: 1px solid transparent;
		border-radius: var(--border-radius);
		background: var(--gray-2);
		color: var(--gray-12);
		font-size: var(--font-5);
		line-height: 1;
	}

	:global(.maplibregl-popup-close-button:is(:hover, :focus-visible)) {
		background: var(--gray-3);
		border-color: var(--color-interface-border);
		color: var(--accent-11);
	}
</style>
