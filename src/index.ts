// Cloudflare Workers script for serving the SPA
export default {
	async fetch(request: Request, env: Env) {
		const url = new URL(request.url)

		// Try to get the asset from the ASSETS binding
		let response = await env.ASSETS.fetch(request)

		// If not found (404) or if it's a redirect, serve index.html for client-side routing (SPA fallback)
		if (response.status === 404 || (response.status >= 300 && response.status < 400)) {
			// Create a new request for index.html using GET method
			const indexRequest = new Request(url.origin + '/index.html', {
				method: 'GET'
			})
			response = await env.ASSETS.fetch(indexRequest)
		}

		return response
	}
}

// Add types for Cloudflare Workers environment
interface Env {
	ASSETS: {
		fetch: (request: Request) => Promise<Response>
	}
}
