// #tags and @mentions in free text (track descriptions). No app imports: the indexer uses it too.

/**
 * Regex for matching hashtags and mentions - shared across components
 */
export const ENTITY_REGEX =
	/(^|\s)([#﹟＃][\p{XID_Continue}\p{Extended_Pictographic}\p{Emoji_Component}_+-]+|@[\p{XID_Continue}_-]+(?:\.[\p{XID_Continue}_-]+)*)/giu

export const HASH_PREFIX_REGEX = /^#/

/**
 * Parse text for entities (hashtags and mentions), invoking `callback` per match.
 * Falsy callback results are dropped from the returned array.
 */
export function parseEntities<T>(
	text: string,
	callback: (match: string, prefix: string, entity: string, offset: number) => T
): T[] {
	if (!text || typeof text !== 'string') return []

	const entities: T[] = []
	text.replace(ENTITY_REGEX, (match, prefix, entity, offset) => {
		entities.push(callback(match, prefix, entity, offset))
		return match
	})

	return entities.filter(Boolean)
}

/**
 * Extract hashtags from text
 */
export function extractHashtags(text: string): string[] {
	return parseEntities(text, (_match, _prefix, entity) =>
		entity.startsWith('#') ? entity.toLowerCase() : ''
	)
}

/**
 * Extract mentions from text
 */
export function extractMentions(text: string): string[] {
	return parseEntities(text, (_match, _prefix, entity) =>
		entity.startsWith('@') ? entity.toLowerCase() : ''
	)
}
