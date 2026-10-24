import {redirect} from '@sveltejs/kit'

// r4-svelte links a radio's track list as /slug/tracks?tags=…; here it is the radio page
export function load({params, url}) {
	redirect(308, `/${params.handle}${url.search}`)
}
