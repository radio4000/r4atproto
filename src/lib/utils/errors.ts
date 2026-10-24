/**
 * Error Handling Utilities
 * Helper functions for consistent error handling
 */

import {
	AppError,
	AuthError,
	NetworkError,
	ValidationError,
	RateLimitError,
	NotFoundError,
	PermissionError,
	ErrorCodes
} from '../errors'

/**
 * Safely extract error message from unknown error type
 */
export function getErrorMessage(error: unknown): string {
	if (error instanceof Error) {
		return error.message
	}
	if (typeof error === 'string') {
		return error
	}
	return String(error)
}

/**
 * Check if error message contains a substring (case-insensitive)
 */
export function errorContains(error: unknown, substring: string): boolean {
	return getErrorMessage(error).toLowerCase().includes(substring.toLowerCase())
}

/**
 * Convert unknown error to AppError
 */
export function toAppError(error: unknown): AppError {
	if (error instanceof AppError) {
		return error
	}

	if (error instanceof Error) {
		return new AppError(error.message, ErrorCodes.UNKNOWN_ERROR, 'An error occurred', error)
	}

	return new AppError(String(error), ErrorCodes.UNKNOWN_ERROR, 'An error occurred', error)
}

/**
 * Check if error is related to authentication
 */
export function isAuthError(error: unknown): boolean {
	if (error instanceof AuthError) return true

	const message = getErrorMessage(error).toLowerCase()
	return (
		message.includes('unauthorized') ||
		message.includes('unauthenticated') ||
		message.includes('invalid session') ||
		message.includes('session expired') ||
		message.includes('invalid token')
	)
}

/**
 * Check if error is related to permissions/scopes
 */
export function isPermissionError(error: unknown): boolean {
	if (error instanceof PermissionError) return true

	const message = getErrorMessage(error).toLowerCase()
	return (
		message.includes('permission') ||
		message.includes('scope') ||
		message.includes('forbidden') ||
		message.includes('not authorized')
	)
}

/**
 * Check if error is rate limit related
 */
export function isRateLimitError(error: unknown): boolean {
	if (error instanceof RateLimitError) return true

	const message = getErrorMessage(error).toLowerCase()
	return message.includes('rate limit') || message.includes('too many requests')
}

/**
 * Check if error is DPoP nonce related
 */
export function isDpopNonceError(error: unknown): boolean {
	const message = getErrorMessage(error).toLowerCase()
	return message.includes('use_dpop_nonce') || message.includes('dpop')
}

/**
 * Check if error is a network error
 */
export function isNetworkError(error: unknown): boolean {
	if (error instanceof NetworkError) return true

	const message = getErrorMessage(error).toLowerCase()
	return (
		message.includes('network') ||
		message.includes('fetch failed') ||
		message.includes('connection') ||
		message.includes('timeout')
	)
}

/**
 * Extract rate limit info from AT Protocol error
 */
export interface RateLimitInfo {
	limit: number
	remaining: number
	reset: number // Unix timestamp
	policy: string
}

export function extractRateLimitInfo(error: unknown): RateLimitInfo | null {
	try {
		const err = error as {headers?: unknown; response?: {headers?: unknown}}
		const headers = (err?.headers || err?.response?.headers) as Record<string, unknown> | undefined

		if (!headers) return null

		const getHeader = (key: string): string | undefined => {
			if (typeof headers === 'object' && headers !== null) {
				// Try get method (Headers API)
				const get = (headers as {get?: (key: string) => string | null}).get
				if (get) return get(key) || undefined

				// Try direct property access
				return (headers[key] as string) || undefined
			}
			return undefined
		}

		const limit = getHeader('ratelimit-limit')
		const remaining = getHeader('ratelimit-remaining')
		const reset = getHeader('ratelimit-reset')
		const policy = getHeader('ratelimit-policy') || ''

		if (limit !== undefined && remaining !== undefined && reset !== undefined) {
			return {
				limit: parseInt(limit),
				remaining: parseInt(remaining),
				reset: parseInt(reset),
				policy
			}
		}
	} catch {
		// Ignore parsing errors
	}

	return null
}

/**
 * Format rate limit info as human-readable message
 */
export function formatRateLimitMessage(info: RateLimitInfo): string {
	const resetDate = new Date(info.reset * 1000)
	const now = new Date()
	const minutesUntilReset = Math.ceil((resetDate.getTime() - now.getTime()) / 1000 / 60)

	return `Rate limit exceeded (${info.remaining}/${info.limit} remaining). Resets in ${minutesUntilReset} minutes.`
}

/**
 * Create RateLimitError from rate limit info
 */
export function createRateLimitError(info: RateLimitInfo, cause?: unknown): RateLimitError {
	const message = formatRateLimitMessage(info)
	const resetDate = new Date(info.reset * 1000)
	const now = new Date()
	const secondsUntilReset = Math.ceil((resetDate.getTime() - now.getTime()) / 1000)

	return new RateLimitError(
		message,
		`Please wait ${Math.ceil(secondsUntilReset / 60)} minutes before trying again.`,
		secondsUntilReset,
		info.limit,
		info.remaining,
		cause
	)
}

/**
 * Handle service error and convert to appropriate AppError
 */
export function handleServiceError(error: unknown): AppError {
	// Already an AppError
	if (error instanceof AppError) {
		return error
	}

	// Check for rate limiting
	if (isRateLimitError(error)) {
		const rateLimitInfo = extractRateLimitInfo(error)
		if (rateLimitInfo) {
			return createRateLimitError(rateLimitInfo, error)
		}
		return new NetworkError(
			getErrorMessage(error),
			ErrorCodes.RATE_LIMIT_EXCEEDED,
			'Too many requests. Please try again later.',
			error
		)
	}

	// Check for auth errors
	if (isAuthError(error)) {
		return new AuthError(
			getErrorMessage(error),
			ErrorCodes.AUTH_FAILED,
			'Authentication failed. Please sign in again.',
			error
		)
	}

	// Check for permission errors
	if (isPermissionError(error)) {
		return new PermissionError(
			getErrorMessage(error),
			'Missing permissions. Please check your settings.',
			error
		)
	}

	// Check for network errors
	if (isNetworkError(error)) {
		return new NetworkError(
			getErrorMessage(error),
			ErrorCodes.NETWORK_ERROR,
			'Network error. Please check your connection.',
			error
		)
	}

	// Generic error
	if (error instanceof Error) {
		return new AppError(
			error.message,
			ErrorCodes.UNKNOWN_ERROR,
			'An unexpected error occurred.',
			error
		)
	}

	return new AppError(
		String(error),
		ErrorCodes.UNKNOWN_ERROR,
		'An unexpected error occurred.',
		error
	)
}
