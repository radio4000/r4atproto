import {sveltekit} from '@sveltejs/kit/vite'
import {vitePreprocess} from '@sveltejs/vite-plugin-svelte'
import adapterStatic from '@sveltejs/adapter-static'
import {defineConfig} from 'vitest/config'

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
				entries: ['/', '/explore', '/search', '/add', '/settings']
			},
			compilerOptions: {
				experimental: {
					// https://svelte.dev/docs/svelte/await-expressions
					async: true
				}
			}
		})
	],
	server: {
		// atproto OAuth loopback clients must use 127.0.0.1, not localhost
		host: '127.0.0.1'
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
