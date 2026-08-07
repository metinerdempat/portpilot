import { json, error } from '@sveltejs/kit';
import { listDockerPorts, containerAction } from '$lib/server/docker';
import { parseInput } from '$lib/server/validate';
import { dockerActionBody } from '$lib/schemas';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	const listing = await listDockerPorts();
	return json(listing);
};

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json().catch(() => ({}));
	const { id, action } = parseInput(dockerActionBody, body);

	const outcome = await containerAction(id, action);
	if (!outcome.ok) throw error(500, outcome.message);

	return json({ ok: true });
};
