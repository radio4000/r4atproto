/**
 * Shared utilities for svelte-tiny-virtual-list implementations
 * Provides consistent patterns for height calculation, infinite scroll, etc.
 */

import {onMount} from 'svelte'
import {browser} from '$app/env'

/**
 * Calculate responsive height based on viewport
 * Usage: const height = useResponsiveHeight(340, 400);
 */
export function useResponsiveHeight(viewportOffset: number = 340, minHeight: number = 400) {
	let height = $state(600)

	onMount(() => {
		if (!browser) return

		const updateHeight = () => {
			height = Math.max(minHeight, window.innerHeight - viewportOffset)
		}

		updateHeight()
		window.addEventListener('resize', updateHeight)
		return () => window.removeEventListener('resize', updateHeight)
	})

	return {
		get value() {
			return height
		}
	}
}

/**
 * Create infinite scroll handler
 * Usage: const handleScroll = createInfiniteScrollHandler({ onLoadMore: more, hasMore, isLoading });
 */
export function createInfiniteScrollHandler(options: {
	onLoadMore: () => void
	hasMore: boolean
	isLoading: boolean
	listRef: any
	listHeight: number
	loadThreshold?: number
}) {
	const {onLoadMore, hasMore, isLoading, listRef, listHeight, loadThreshold = 300} = options

	return (event: CustomEvent) => {
		if (!hasMore || isLoading) return

		const {offset} = event.detail
		const totalHeight = listRef?.getTotalSize?.() || 0

		if (totalHeight - (offset + listHeight) < loadThreshold) {
			onLoadMore()
		}
	}
}

/**
 * Common VirtualList item size patterns
 */
export const ItemSizes = {
	/**
	 * Fixed size for all items
	 */
	fixed: (size: number) => size,

	/**
	 * Variable size based on content
	 */
	variable: (sizes: {[key: string]: number}, defaultSize: number = 68) => {
		return (index: number, items: any[], condition: (item: any) => string) => {
			const item = items[index]
			if (!item) return defaultSize
			const key = condition(item)
			return sizes[key] ?? defaultSize
		}
	}
}

/**
 * Common key extraction patterns
 */
export const KeyExtractors = {
	/**
	 * Use URI or fallback to index
	 */
	uri: (items: any[]) => (i: number) => items[i]?.uri || items[i]?.url || i,

	/**
	 * Use custom field or fallback to index
	 */
	field: (items: any[], field: string) => (i: number) => items[i]?.[field] || i,

	/**
	 * For grouped data (headers + items)
	 */
	grouped:
		(items: any[], itemKey: string = 'uri') =>
		(i: number) => {
			const item = items[i]
			return item?.kind === 'header' ? `header-${item.key}` : item?.[itemKey] || i
		}
}

/**
 * Debounce helper for search/filter
 */
export function createDebouncedState<T>(initialValue: T, delay: number = 200) {
	let immediate = $state(initialValue)
	let debounced = $state(initialValue)
	let timer: ReturnType<typeof setTimeout> | null = null

	return {
		get immediate() {
			return immediate
		},
		set immediate(value: T) {
			immediate = value
			if (timer) clearTimeout(timer)

			// Clear immediately if empty
			if (!value || (typeof value === 'string' && value === '')) {
				debounced = value
				return
			}

			timer = setTimeout(() => {
				debounced = value
			}, delay)
		},
		get debounced() {
			return debounced
		}
	}
}
