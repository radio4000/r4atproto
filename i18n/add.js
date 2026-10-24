#!/usr/bin/env node
/**
 * Add or update message keys from a JSON batch: {"key": {"en": "...", "fr": "..."}}
 * Usage: node i18n/add.js batch.json
 * Keeps files sorted. Other locales fall back to English until translated.
 */
import {readFileSync, writeFileSync} from 'fs'
import {join, dirname} from 'path'
import {fileURLToPath} from 'url'

const dir = join(dirname(fileURLToPath(import.meta.url)), 'messages')
const batch = JSON.parse(readFileSync(process.argv[2], 'utf8'))
const byLocale = {}
for (const [key, values] of Object.entries(batch)) {
	for (const [locale, value] of Object.entries(values)) (byLocale[locale] ??= {})[key] = value
}
for (const [locale, entries] of Object.entries(byLocale)) {
	const path = join(dir, `${locale}.json`)
	const {$schema, ...messages} = JSON.parse(readFileSync(path, 'utf8'))
	Object.assign(messages, entries)
	const sorted = Object.fromEntries(Object.entries(messages).sort(([a], [b]) => a.localeCompare(b)))
	writeFileSync(path, JSON.stringify($schema ? {$schema, ...sorted} : sorted, null, '\t') + '\n')
	console.log(locale, Object.keys(entries).length)
}
