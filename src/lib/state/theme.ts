import {writable, type Writable} from 'svelte/store'
import {browser} from '$app/environment'

export type ThemeMode = 'light' | 'dark' | 'auto'

export interface ThemeColors {
	background: string
	foreground: string
	accent: string
}

export interface ThemeData {
	mode: ThemeMode
	lightColors: ThemeColors
	darkColors: ThemeColors
}

export interface ThemeStore extends Writable<ThemeData> {
	setMode: (mode: ThemeMode) => void
	setLightColors: (colors: ThemeColors) => void
	setDarkColors: (colors: ThemeColors) => void
	getEffectiveMode: () => 'light' | 'dark'
}

// Default theme colors (current purple theme)
export const DEFAULT_LIGHT_COLORS: ThemeColors = {
	background: '0 0% 100%', // white
	foreground: '240 10% 3.9%', // dark blue-gray
	accent: '262 83% 58%' // purple
}

export const DEFAULT_DARK_COLORS: ThemeColors = {
	background: '240 10% 3.9%', // very dark blue
	foreground: '0 0% 98%', // off-white
	accent: '262 83% 58%' // purple
}

function getSystemPreference(): 'light' | 'dark' {
	if (!browser) return 'light'
	return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function createThemeStore(): ThemeStore {
	const initialData: ThemeData = {
		mode: 'auto',
		lightColors: DEFAULT_LIGHT_COLORS,
		darkColors: DEFAULT_DARK_COLORS
	}

	const {subscribe, set, update} = writable<ThemeData>(initialData)

	// Listen for system preference changes
	if (browser) {
		const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
		mediaQuery.addEventListener('change', () => {
			// Trigger reactivity by updating the store
			update((data) => ({...data}))
		})
	}

	function setMode(mode: ThemeMode): void {
		update((data) => ({...data, mode}))
	}

	function setLightColors(colors: ThemeColors): void {
		update((data) => ({...data, lightColors: colors}))
	}

	function setDarkColors(colors: ThemeColors): void {
		update((data) => ({...data, darkColors: colors}))
	}

	function getEffectiveMode(): 'light' | 'dark' {
		let currentMode: ThemeMode = 'auto'
		subscribe((data) => {
			currentMode = data.mode
		})()

		if (currentMode === 'auto') {
			return getSystemPreference()
		}
		return currentMode
	}

	return {
		subscribe,
		set,
		update,
		setMode,
		setLightColors,
		setDarkColors,
		getEffectiveMode
	}
}

export const theme = createThemeStore()
