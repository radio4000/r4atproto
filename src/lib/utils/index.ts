import {clsx, type ClassValue} from 'clsx'
import {twMerge} from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
	return twMerge(clsx(inputs))
}

/**
 * Consistent menu item styling with nav-like hover states
 */
export const menuItemClass = cn(
	'flex w-full items-center gap-2 px-3.5 py-2.5 text-sm text-left justify-start',
	'transition-all duration-200 border border-border bg-background',
	'text-foreground hover:text-background hover:bg-foreground hover:border-foreground',
	'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2',
	'disabled:opacity-50 disabled:pointer-events-none disabled:border-border disabled:bg-background disabled:text-foreground'
)

/**
 * Shared contextual menu trigger styling
 */
export const menuTriggerClass = (active = false) => {
	const base = [
		'inline-flex items-center justify-center rounded-md border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2',
		'bg-background text-foreground border-border'
	]
	if (active) {
		return cn(
			...base,
			'bg-foreground text-background border-foreground shadow-sm',
			'hover:bg-foreground hover:text-background hover:border-[hsl(var(--background))]'
		)
	}
	return cn(...base, 'hover:bg-foreground hover:text-background hover:border-foreground')
}
