/**
 * Component Error Handler Utilities
 * Provides standardized error handling for Svelte components
 */

import { toast } from '#lib/stores/toast.svelte.js'
import { handleServiceError } from './errors'
import { AppError } from '../errors'

export interface ComponentErrorOptions {
  /**
   * Show toast notification on error
   */
  showToast?: boolean

  /**
   * Log error to console
   */
  logToConsole?: boolean

  /**
   * Custom error message prefix
   */
  messagePrefix?: string

  /**
   * Fallback message if error cannot be parsed
   */
  fallbackMessage?: string
}

const defaultOptions: Required<ComponentErrorOptions> = {
  showToast: true,
  logToConsole: true,
  messagePrefix: '',
  fallbackMessage: 'An unexpected error occurred'
}

/**
 * Handle errors in components with consistent behavior
 *
 * @param error - The error to handle
 * @param options - Configuration options
 * @returns Normalized AppError
 *
 * @example
 * ```ts
 * try {
 *   await deleteTrack(uri)
 * } catch (error) {
 *   handleComponentError(error, {
 *     messagePrefix: 'Failed to delete track',
 *     showToast: true
 *   })
 * }
 * ```
 */
export function handleComponentError(
  error: unknown,
  options: ComponentErrorOptions = {}
): AppError {
  const opts = { ...defaultOptions, ...options }

  // Convert to AppError
  const appError = handleServiceError(error)

  // Construct user-facing message
  let userMessage = appError.userMessage || appError.message || opts.fallbackMessage
  if (opts.messagePrefix) {
    userMessage = `${opts.messagePrefix}: ${userMessage}`
  }

  // Log to console
  if (opts.logToConsole) {
    console.error('[Component Error]', {
      message: userMessage,
      code: appError.code,
      original: error
    })
  }

  // Show toast
  if (opts.showToast) {
    toast.error(userMessage)
  }

  return appError
}

/**
 * Wrap an async function with error handling
 *
 * @example
 * ```ts
 * const handleDelete = withErrorHandling(
 *   async () => await deleteTrack(uri),
 *   { messagePrefix: 'Failed to delete track' }
 * )
 *
 * await handleDelete() // Automatically handles errors
 * ```
 */
export function withErrorHandling<T>(
  fn: () => Promise<T>,
  options: ComponentErrorOptions = {}
): () => Promise<T | undefined> {
  return async () => {
    try {
      return await fn()
    } catch (error) {
      handleComponentError(error, options)
      return undefined
    }
  }
}

/**
 * Create an error handler function bound to specific options
 *
 * Useful for creating consistent error handlers in a component
 *
 * @example
 * ```ts
 * const handleError = createErrorHandler({
 *   messagePrefix: 'Track operation failed',
 *   showToast: true
 * })
 *
 * try {
 *   await updateTrack()
 * } catch (error) {
 *   handleError(error)
 * }
 * ```
 */
export function createErrorHandler(options: ComponentErrorOptions = {}) {
  return (error: unknown) => handleComponentError(error, options)
}

/**
 * Handle silent errors (log only, no user notification)
 *
 * Use for non-critical errors where user notification would be annoying
 *
 * @example
 * ```ts
 * try {
 *   await trackAnalytics()
 * } catch (error) {
 *   handleSilentError(error, 'Analytics tracking failed')
 * }
 * ```
 */
export function handleSilentError(error: unknown, context?: string) {
  const appError = handleServiceError(error)
  console.warn(
    `[Silent Error${context ? `: ${context}` : ''}]`,
    appError.message,
    error
  )
}
