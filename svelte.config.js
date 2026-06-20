import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const basePath = process.env.R4_BASE || '';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),

	kit: {
		adapter: adapter({
			pages: 'dist',
			assets: 'dist',
			fallback: 'index.html',
			precompress: false,
			strict: true
		}),
		paths: {
			base: basePath
		},
		prerender: {
			handleMissingId: 'ignore',
			handleHttpError: 'warn',
			entries: ['/', '/network', '/search', '/add', '/settings'],
			handleUnseenRoutes: 'ignore'
		}
	}
};

export default config;
