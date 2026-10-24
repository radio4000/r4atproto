/**
 * Toast Notification Store
 * Manages toast notifications for user feedback
 */

export interface Toast {
	id: string
	type: 'success' | 'error' | 'info' | 'warning'
	message: string
	duration?: number // milliseconds, undefined = persistent until dismissed
}

interface ToastState {
	toasts: Toast[]
}

const state = $state<ToastState>({
	toasts: []
})

let nextId = 0

/**
 * Add a toast notification
 */
export function addToast(toast: Omit<Toast, 'id'>): string {
	const id = `toast-${nextId++}`
	const newToast: Toast = {id, ...toast}

	state.toasts = [...state.toasts, newToast]

	// Auto-dismiss after duration (default 5 seconds for non-error toasts)
	if (toast.duration !== undefined) {
		setTimeout(() => removeToast(id), toast.duration)
	} else if (toast.type !== 'error') {
		// Default: auto-dismiss non-error toasts after 5 seconds
		setTimeout(() => removeToast(id), 5000)
	}

	return id
}

/**
 * Remove a toast by ID
 */
export function removeToast(id: string) {
	state.toasts = state.toasts.filter((t) => t.id !== id)
}

/**
 * Clear all toasts
 */
export function clearAllToasts() {
	state.toasts = []
}

/**
 * Convenience methods for different toast types
 */
export const toast = {
	success: (message: string, duration?: number) => addToast({type: 'success', message, duration}),

	error: (message: string, duration?: number) => addToast({type: 'error', message, duration}),

	info: (message: string, duration?: number) => addToast({type: 'info', message, duration}),

	warning: (message: string, duration?: number) => addToast({type: 'warning', message, duration})
}

/**
 * Reactive getter for toasts
 */
export function getToasts() {
	return state.toasts
}
