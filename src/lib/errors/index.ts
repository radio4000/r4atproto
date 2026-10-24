/**
 * Custom Error Classes
 * Standardized error handling across the application
 */

/**
 * Base application error with additional context
 */
export class AppError extends Error {
	constructor(
		message: string,
		public code: string,
		public userMessage: string,
		public cause?: unknown
	) {
		super(message)
		this.name = 'AppError'
		Object.setPrototypeOf(this, AppError.prototype)
	}
}

/**
 * Authentication and authorization errors
 */
export class AuthError extends AppError {
	constructor(message: string, code: string, userMessage: string, cause?: unknown) {
		super(message, code, userMessage, cause)
		this.name = 'AuthError'
		Object.setPrototypeOf(this, AuthError.prototype)
	}
}

/**
 * Network and API errors
 */
export class NetworkError extends AppError {
	constructor(message: string, code: string, userMessage: string, cause?: unknown) {
		super(message, code, userMessage, cause)
		this.name = 'NetworkError'
		Object.setPrototypeOf(this, NetworkError.prototype)
	}
}

/**
 * Validation errors
 */
export class ValidationError extends AppError {
	constructor(message: string, code: string, userMessage: string, cause?: unknown) {
		super(message, code, userMessage, cause)
		this.name = 'ValidationError'
		Object.setPrototypeOf(this, ValidationError.prototype)
	}
}

/**
 * Rate limiting errors
 */
export class RateLimitError extends NetworkError {
	constructor(
		message: string,
		userMessage: string,
		public retryAfter: number, // seconds until reset
		public limit: number,
		public remaining: number,
		cause?: unknown
	) {
		super(message, 'RATE_LIMIT_EXCEEDED', userMessage, cause)
		this.name = 'RateLimitError'
		Object.setPrototypeOf(this, RateLimitError.prototype)
	}
}

/**
 * Not found errors
 */
export class NotFoundError extends AppError {
	constructor(message: string, userMessage: string, cause?: unknown) {
		super(message, 'NOT_FOUND', userMessage, cause)
		this.name = 'NotFoundError'
		Object.setPrototypeOf(this, NotFoundError.prototype)
	}
}

/**
 * Permission errors
 */
export class PermissionError extends AuthError {
	constructor(message: string, userMessage: string, cause?: unknown) {
		super(message, 'PERMISSION_DENIED', userMessage, cause)
		this.name = 'PermissionError'
		Object.setPrototypeOf(this, PermissionError.prototype)
	}
}

// Error codes
export const ErrorCodes = {
	// Auth
	AUTH_FAILED: 'AUTH_FAILED',
	SESSION_EXPIRED: 'SESSION_EXPIRED',
	PERMISSION_DENIED: 'PERMISSION_DENIED',
	SCOPE_MISSING: 'SCOPE_MISSING',

	// Network
	NETWORK_ERROR: 'NETWORK_ERROR',
	RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
	TIMEOUT: 'TIMEOUT',

	// Validation
	INVALID_INPUT: 'INVALID_INPUT',
	INVALID_URL: 'INVALID_URL',

	// Resources
	NOT_FOUND: 'NOT_FOUND',
	ALREADY_EXISTS: 'ALREADY_EXISTS',

	// Unknown
	UNKNOWN_ERROR: 'UNKNOWN_ERROR'
} as const

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes]
