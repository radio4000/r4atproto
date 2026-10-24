/**
 * Links from records are user input. The lexicons check their type and length
 * (schemas.ts); only http(s) links are used, so no javascript: or data: URL
 * ever reaches an href or a player.
 */

/** The URL when it is http(s), else null */
export function safeUrl(value: unknown): string | null {
	if (typeof value !== 'string') return null
	try {
		const {protocol} = new URL(value)
		return protocol === 'https:' || protocol === 'http:' ? value : null
	} catch {
		return null
	}
}
