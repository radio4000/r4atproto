import {sveltekit} from '@sveltejs/kit/vite'
import {vitePreprocess} from '@sveltejs/vite-plugin-svelte'
import adapterStatic from '@sveltejs/adapter-static'
import {defineConfig} from 'vitest/config'
import {paraglideVitePlugin} from '@inlang/paraglide-js'
import app from './src/lib/config/app.json' with {type: 'json'}

/** CSP host sources from config (JSON gives plain strings) */
const hosts = (list: string[]) => list as `https://${string}.${string}`[]

export default defineConfig({
	plugins: [
		sveltekit({
			preprocess: vitePreprocess(),
			// Fully static SPA: atproto is the backend, there is no server of ours.
			adapter: adapterStatic({pages: 'dist', assets: 'dist', fallback: 'index.html', strict: true}),
			prerender: {
				handleMissingId: 'ignore',
				handleHttpError: 'warn',
				handleUnseenRoutes: 'ignore',
				entries: ['/', '/explore', '/search', '/add', '/settings', '/client-metadata.json']
			},
			// Content Security Policy, as a meta tag with hashes of Kit's inline scripts.
			// Repos (PDSes) live anywhere, so reads go to any https/wss host; scripts and
			// frames only from us and the media embeds (config/app.json csp).
			// Framing of the app itself is refused in static/_headers.
			csp: {
				mode: 'hash',
				directives: {
					'default-src': ['self'],
					'script-src': ['self', ...hosts(app.csp.scripts)],
					'frame-src': hosts(app.csp.frames),
					'connect-src': ['self', 'https:', 'wss:'],
					'img-src': ['self', 'https:', 'data:', 'blob:'],
					'media-src': ['self', 'https:', 'blob:'],
					'style-src': ['self', 'unsafe-inline'],
					'font-src': ['self'],
					'worker-src': ['self', 'blob:'],
					'object-src': ['none'],
					'base-uri': ['self']
				}
			},
			compilerOptions: {
				experimental: {
					// https://svelte.dev/docs/svelte/await-expressions
					async: true
				}
			}
		}),
		paraglideVitePlugin({
			project: './i18n/project.inlang',
			outdir: './src/lib/paraglide',
			// The locale is chosen in the app and remembered in localStorage; no URL prefixes
			strategy: ['localStorage', 'preferredLanguage', 'baseLocale']
		})
	],
	server: {
		// atproto OAuth loopback clients must use 127.0.0.1, not localhost
		host: '127.0.0.1'
	},
	// Component tests mount in happy-dom, so resolve Svelte's browser build
	resolve: process.env.VITEST ? {conditions: ['browser']} : undefined,
	optimizeDeps: {
		// MapLibre 6 resolves its ESM worker via import.meta.url, which Vite's prebundler drops in dev
		exclude: ['maplibre-gl']
	},
	build: {
		target: 'esnext',
		reportCompressedSize: false
	},
	test: {
		environment: 'happy-dom',
		globals: true,
		reporters: ['dot'],
		setupFiles: ['./vitest.setup.js']
	}
})
