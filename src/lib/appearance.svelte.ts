/**
 * Appearance settings applied to the document: theme, custom CSS variables (accent,
 * scale, corners), font, and attributes on <html> that styles/variables.css reads.
 * Call applyAppearance() once from the root layout.
 */
import {MediaQuery} from 'svelte/reactivity'
import {appState} from '#lib/app-state.svelte.js'
import ui from '#lib/config/ui.json' with {type: 'json'}

export const {fonts, scale} = ui.appearance

/** CSS variables the appearance settings write into custom_css_variables */
export const appearanceVariables = {
	accentLight: '--accent-light',
	accentDark: '--accent-dark',
	scaling: '--scaling',
	borderRadius: '--border-radius'
} as const

/** Set or clear (empty value) custom CSS variables */
export function setCssVariables(changes: Record<string, string>) {
	const vars = {...appState.custom_css_variables}
	for (const [name, value] of Object.entries(changes)) {
		if (value) vars[name] = value
		else delete vars[name]
	}
	appState.custom_css_variables = vars
}

/** Back to the default look */
export function resetAppearance() {
	appState.custom_css_variables = {}
	appState.font_family = undefined
	appState.use_pointer_cursor = true
	appState.floating_ui = true
	appState.show_borders = true
	appState.show_track_artwork = true
}

export function applyAppearance() {
	const root = document.documentElement

	// Theme: the saved preference, else the system's
	const prefersLight = new MediaQuery('(prefers-color-scheme: light)')
	$effect(() => {
		root.setAttribute('theme', appState.theme ?? (prefersLight.current ? 'light' : 'dark'))
	})

	let appliedVariables: string[] = []
	$effect(() => {
		const vars = appState.custom_css_variables ?? {}
		for (const name of appliedVariables) if (!(name in vars)) root.style.removeProperty(name)
		for (const [name, value] of Object.entries(vars)) root.style.setProperty(name, value)
		appliedVariables = Object.keys(vars)
	})

	$effect(() => {
		const family = fonts.find((font) => font.id === appState.font_family)?.family
		if (family) root.style.setProperty('--font-sans', family)
		else root.style.removeProperty('--font-sans')
	})

	$effect(() => {
		root.setAttribute('floating', String(appState.floating_ui !== false))
		root.setAttribute('borders', String(appState.show_borders !== false))
		root.setAttribute('pointer-cursor', String(appState.use_pointer_cursor !== false))
	})
}
