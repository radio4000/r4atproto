import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	server: {
		// host: true,
		host: '127.0.0.1',
		allowedHosts: ["c3.risk-tritone.ts.net"]
	}
});
