import type { PageLoad } from './$types';
import { resolveHandle } from '#lib/services/r4-service.js';

export const ssr = false;
export const prerender = false;

export const load: PageLoad = async ({ params }) => {
	const rawHandle = params.handle?.replace(/^@/, '') ?? '';
	const rkey = params.rkey ?? '';
	// params doesn't have repo, so we derive it from handle
	let repo = '';

	if (rawHandle) {
		try {
			repo = (await resolveHandle(rawHandle)) || '';
		} catch {
			repo = '';
		}
	}

	return {
		repo,
		handle: params.handle,
		rkey
	};
};
