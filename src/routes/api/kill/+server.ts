import { json, error } from '@sveltejs/kit';
import { killPort } from '$lib/server/ports';
import { parseInput } from '$lib/server/validate';
import { killBody } from '$lib/schemas';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json().catch(() => ({}));
	const { pid, force } = parseInput(killBody, body);

	const outcome = await killPort(pid, force);
	if (!outcome.ok) {
		const status =
			outcome.reason === 'forbidden'
				? 403
				: outcome.reason === 'not-found'
					? 404
					: outcome.reason === 'invalid'
						? 400
						: 500;
		throw error(status, outcome.message);
	}

	return json({ ok: true });
};
