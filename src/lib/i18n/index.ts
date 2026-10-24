import {writable, type Writable} from 'svelte/store'
import en from './locales/en'
import fr from './locales/fr'

const translations = {
	en,
	fr
}

export type Locale = keyof typeof translations

const STORAGE_KEY = 'r4.locale'
const browser = typeof window !== 'undefined'

function getInitialLocale(): Locale {
	if (!browser) return 'en'
	try {
		const stored = localStorage.getItem(STORAGE_KEY)
		if (stored && stored in translations) return stored as Locale
		const language = navigator.language?.toLowerCase() || ''
		if (language.startsWith('fr')) return 'fr'
	} catch {
		// ignore
	}
	return 'en'
}

export const locale: Writable<Locale> = writable(getInitialLocale())

if (browser) {
	locale.subscribe((value) => {
		try {
			localStorage.setItem(STORAGE_KEY, value)
		} catch {
			// ignore storage issues
		}
	})
}

export function translate(
	current: Locale,
	key: string,
	vars: Record<string, string | number> = {}
): string {
	const segments = key.split('.')
	let value: any = translations[current]
	for (const segment of segments) {
		value = value?.[segment]
	}
	if (typeof value !== 'string') {
		return key
	}
	return value.replace(/\{(\w+)\}/g, (_, token) => {
		return (vars[token] ?? `{${token}}`).toString()
	})
}

export const availableLocales: Array<{code: Locale; label: string}> = [
	{code: 'en', label: 'English'},
	{code: 'fr', label: 'Français'}
]

export function getTranslationTable(current: Locale) {
	return translations[current]
}
