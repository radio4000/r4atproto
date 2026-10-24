/**
 * Loading State Composable
 * Standardizes loading and error state management across components
 *
 * Usage:
 * ```ts
 * const loadingState = useLoadingState()
 *
 * async function fetchData() {
 *   loadingState.startLoading()
 *   try {
 *     const data = await api.getData()
 *     loadingState.complete()
 *     return data
 *   } catch (error) {
 *     loadingState.setError(error)
 *   }
 * }
 * ```
 */

import {toast} from '#lib/stores/toast.svelte.js'

export interface LoadingState {
	isLoading: boolean
	error: string | null
	isComplete: boolean
}

export interface LoadingActions {
	startLoading: () => void
	setError: (error: unknown, showToast?: boolean) => void
	complete: () => void
	reset: () => void
}

export type UseLoadingStateReturn = LoadingState & LoadingActions

/**
 * Create a loading state manager
 * @param initialLoading - Start in loading state (default: false)
 * @param showToastOnError - Automatically show toast on error (default: false)
 * @returns Loading state and actions
 */
export function useLoadingState(
	initialLoading = false,
	showToastOnError = false
): UseLoadingStateReturn {
	const state = $state<LoadingState>({
		isLoading: initialLoading,
		error: null,
		isComplete: false
	})

	/**
	 * Start loading (clears previous error)
	 */
	function startLoading() {
		state.isLoading = true
		state.error = null
		state.isComplete = false
	}

	/**
	 * Set error state and optionally show toast
	 */
	function setError(error: unknown, showToast = showToastOnError) {
		state.isLoading = false
		state.isComplete = false

		// Extract error message
		if (error instanceof Error) {
			state.error = error.message
		} else if (typeof error === 'string') {
			state.error = error
		} else {
			state.error = 'An unknown error occurred'
		}

		// Show toast if requested
		if (showToast && state.error) {
			toast.error(state.error)
		}
	}

	/**
	 * Mark as complete (no error)
	 */
	function complete() {
		state.isLoading = false
		state.error = null
		state.isComplete = true
	}

	/**
	 * Reset to initial state
	 */
	function reset() {
		state.isLoading = initialLoading
		state.error = null
		state.isComplete = false
	}

	return {
		get isLoading() {
			return state.isLoading
		},
		get error() {
			return state.error
		},
		get isComplete() {
			return state.isComplete
		},
		startLoading,
		setError,
		complete,
		reset
	}
}

/**
 * Async wrapper that automatically manages loading state
 *
 * Usage:
 * ```ts
 * const loadingState = useLoadingState()
 *
 * const fetchData = withLoadingState(loadingState, async () => {
 *   return await api.getData()
 * })
 *
 * await fetchData() // Automatically manages loading/error/complete
 * ```
 */
export function withLoadingState<T>(
	loadingState: UseLoadingStateReturn,
	asyncFn: () => Promise<T>,
	showToastOnError = false
): () => Promise<T | undefined> {
	return async () => {
		loadingState.startLoading()
		try {
			const result = await asyncFn()
			loadingState.complete()
			return result
		} catch (error) {
			loadingState.setError(error, showToastOnError)
			return undefined
		}
	}
}
