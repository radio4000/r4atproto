import {describe, it, expect} from 'vitest'
import {
	getErrorMessage,
	errorContains,
	toAppError,
	isAuthError,
	isPermissionError,
	isRateLimitError,
	isDpopNonceError,
	isNetworkError,
	extractRateLimitInfo,
	formatRateLimitMessage,
	createRateLimitError,
	handleServiceError
} from './errors'
import {
	AppError,
	AuthError,
	NetworkError,
	PermissionError,
	RateLimitError,
	ErrorCodes
} from '../errors'

describe('Error Utilities', () => {
	describe('getErrorMessage', () => {
		it('should extract message from Error object', () => {
			const error = new Error('Test error')
			expect(getErrorMessage(error)).toBe('Test error')
		})

		it('should handle string errors', () => {
			expect(getErrorMessage('String error')).toBe('String error')
		})

		it('should handle unknown types', () => {
			expect(getErrorMessage(123)).toBe('123')
			expect(getErrorMessage({foo: 'bar'})).toBe('[object Object]')
		})
	})

	describe('errorContains', () => {
		it('should check if error message contains substring (case-insensitive)', () => {
			const error = new Error('Authentication Failed')
			expect(errorContains(error, 'authentication')).toBe(true)
			expect(errorContains(error, 'AUTHENTICATION')).toBe(true)
			expect(errorContains(error, 'failed')).toBe(true)
			expect(errorContains(error, 'success')).toBe(false)
		})

		it('should work with string errors', () => {
			expect(errorContains('Network timeout', 'timeout')).toBe(true)
			expect(errorContains('Network timeout', 'success')).toBe(false)
		})
	})

	describe('toAppError', () => {
		it('should return AppError as-is', () => {
			const appError = new AppError('test', 'TEST', 'Test message')
			expect(toAppError(appError)).toBe(appError)
		})

		it('should convert Error to AppError', () => {
			const error = new Error('Standard error')
			const appError = toAppError(error)
			expect(appError).toBeInstanceOf(AppError)
			expect(appError.message).toBe('Standard error')
			expect(appError.code).toBe(ErrorCodes.UNKNOWN_ERROR)
		})

		it('should convert string to AppError', () => {
			const appError = toAppError('String error')
			expect(appError).toBeInstanceOf(AppError)
			expect(appError.message).toBe('String error')
		})
	})

	describe('isAuthError', () => {
		it('should detect AuthError instances', () => {
			const error = new AuthError('Auth failed', 'AUTH_FAILED', 'Please sign in')
			expect(isAuthError(error)).toBe(true)
		})

		it('should detect auth-related messages', () => {
			expect(isAuthError(new Error('Unauthorized access'))).toBe(true)
			expect(isAuthError(new Error('Unauthenticated request'))).toBe(true)
			expect(isAuthError(new Error('Invalid session'))).toBe(true)
			expect(isAuthError(new Error('Session expired'))).toBe(true)
			expect(isAuthError(new Error('Invalid token'))).toBe(true)
		})

		it('should not detect non-auth errors', () => {
			expect(isAuthError(new Error('Network error'))).toBe(false)
		})
	})

	describe('isPermissionError', () => {
		it('should detect PermissionError instances', () => {
			const error = new PermissionError('No access', 'Access denied')
			expect(isPermissionError(error)).toBe(true)
		})

		it('should detect permission-related messages', () => {
			expect(isPermissionError(new Error('Permission denied'))).toBe(true)
			expect(isPermissionError(new Error('Missing scope'))).toBe(true)
			expect(isPermissionError(new Error('Forbidden'))).toBe(true)
			expect(isPermissionError(new Error('Not authorized'))).toBe(true)
		})
	})

	describe('isRateLimitError', () => {
		it('should detect RateLimitError instances', () => {
			const error = new RateLimitError('Rate limited', 'Wait', 60, 100, 0)
			expect(isRateLimitError(error)).toBe(true)
		})

		it('should detect rate limit messages', () => {
			expect(isRateLimitError(new Error('Rate limit exceeded'))).toBe(true)
			expect(isRateLimitError(new Error('Too many requests'))).toBe(true)
		})
	})

	describe('isDpopNonceError', () => {
		it('should detect DPoP nonce errors', () => {
			expect(isDpopNonceError(new Error('use_dpop_nonce required'))).toBe(true)
			expect(isDpopNonceError(new Error('DPoP validation failed'))).toBe(true)
			expect(isDpopNonceError(new Error('Other error'))).toBe(false)
		})
	})

	describe('isNetworkError', () => {
		it('should detect NetworkError instances', () => {
			const error = new NetworkError('Failed', 'NETWORK', 'Network failed')
			expect(isNetworkError(error)).toBe(true)
		})

		it('should detect network-related messages', () => {
			expect(isNetworkError(new Error('Network error'))).toBe(true)
			expect(isNetworkError(new Error('Fetch failed'))).toBe(true)
			expect(isNetworkError(new Error('Connection refused'))).toBe(true)
			expect(isNetworkError(new Error('Timeout'))).toBe(true)
		})
	})

	describe('extractRateLimitInfo', () => {
		it('should extract rate limit headers from error', () => {
			const error = {
				headers: {
					'ratelimit-limit': '100',
					'ratelimit-remaining': '50',
					'ratelimit-reset': '1234567890',
					'ratelimit-policy': 'policy-1'
				}
			}

			const info = extractRateLimitInfo(error)
			expect(info).toEqual({
				limit: 100,
				remaining: 50,
				reset: 1234567890,
				policy: 'policy-1'
			})
		})

		it('should handle Headers API with get method', () => {
			const headers = {
				get: (key: string) => {
					const map: Record<string, string> = {
						'ratelimit-limit': '200',
						'ratelimit-remaining': '100',
						'ratelimit-reset': '9876543210'
					}
					return map[key] || null
				}
			}

			const error = {headers}
			const info = extractRateLimitInfo(error)
			expect(info).toEqual({
				limit: 200,
				remaining: 100,
				reset: 9876543210,
				policy: ''
			})
		})

		it('should return null for missing headers', () => {
			expect(extractRateLimitInfo({})).toBeNull()
			expect(extractRateLimitInfo({headers: {}})).toBeNull()
			expect(extractRateLimitInfo(new Error('test'))).toBeNull()
		})
	})

	describe('formatRateLimitMessage', () => {
		it('should format rate limit info', () => {
			const futureTime = Math.floor(Date.now() / 1000) + 300 // 5 minutes from now
			const info = {
				limit: 100,
				remaining: 0,
				reset: futureTime,
				policy: 'test'
			}

			const message = formatRateLimitMessage(info)
			expect(message).toContain('Rate limit exceeded')
			expect(message).toContain('0/100')
			expect(message).toContain('5 minutes')
		})
	})

	describe('createRateLimitError', () => {
		it('should create RateLimitError from info', () => {
			const futureTime = Math.floor(Date.now() / 1000) + 300
			const info = {
				limit: 100,
				remaining: 0,
				reset: futureTime,
				policy: 'test'
			}

			const error = createRateLimitError(info)
			expect(error).toBeInstanceOf(RateLimitError)
			expect(error.limit).toBe(100)
			expect(error.remaining).toBe(0)
			expect(error.code).toBe('RATE_LIMIT_EXCEEDED')
		})
	})

	describe('handleServiceError', () => {
		it('should return AppError as-is', () => {
			const appError = new AppError('test', 'TEST', 'Test')
			expect(handleServiceError(appError)).toBe(appError)
		})

		it('should convert auth errors', () => {
			const error = new Error('Unauthorized')
			const result = handleServiceError(error)
			expect(result).toBeInstanceOf(AuthError)
			expect(result.code).toBe(ErrorCodes.AUTH_FAILED)
		})

		it('should convert permission errors', () => {
			const error = new Error('Permission denied')
			const result = handleServiceError(error)
			expect(result).toBeInstanceOf(PermissionError)
			expect(result.code).toBe('PERMISSION_DENIED')
		})

		it('should convert network errors', () => {
			const error = new Error('Network timeout')
			const result = handleServiceError(error)
			expect(result).toBeInstanceOf(NetworkError)
			expect(result.code).toBe(ErrorCodes.NETWORK_ERROR)
		})

		it('should convert rate limit errors with headers', () => {
			const futureTime = Math.floor(Date.now() / 1000) + 300
			const error = new Error('Rate limit exceeded')
			// Add headers to the error object
			;(error as Error & {headers: Record<string, string>}).headers = {
				'ratelimit-limit': '100',
				'ratelimit-remaining': '0',
				'ratelimit-reset': futureTime.toString()
			}

			const result = handleServiceError(error)
			expect(result).toBeInstanceOf(RateLimitError)
			expect(result.code).toBe(ErrorCodes.RATE_LIMIT_EXCEEDED)
		})

		it('should handle unknown errors', () => {
			const error = new Error('Unknown error')
			const result = handleServiceError(error)
			expect(result).toBeInstanceOf(AppError)
			expect(result.code).toBe(ErrorCodes.UNKNOWN_ERROR)
		})
	})
})
