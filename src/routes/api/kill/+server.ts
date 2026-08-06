import { json, error } from '@sveltejs/kit';
import { killByPid } from '$lib/server/ports';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	let body: { pid?: unknown; force?: unknown };
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid request body.');
	}

	const pid = Number(body.pid);
	if (!Number.isInteger(pid)) {
		throw error(400, 'A valid PID is required.');
	}

	const outcome = killByPid(pid, Boolean(body.force));
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
