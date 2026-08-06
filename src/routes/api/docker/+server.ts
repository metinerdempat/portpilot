import { json, error } from '@sveltejs/kit';
import { listDockerPorts, containerAction } from '$lib/server/docker';
import type { ContainerAction } from '$lib/types';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	const listing = await listDockerPorts();
	return json(listing);
};

export const POST: RequestHandler = async ({ request }) => {
	let body: { id?: unknown; action?: unknown };
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid request body.');
	}

	const id = typeof body.id === 'string' ? body.id : '';
	if (!id) throw error(400, 'Container id is required.');

	// Defaults to 'stop' so the ports view (which sends only { id }) keeps working.
	const action: ContainerAction =
		body.action === 'start' || body.action === 'restart' ? body.action : 'stop';

	const outcome = await containerAction(id, action);
	if (!outcome.ok) {
		throw error(500, outcome.message);
	}
	return json({ ok: true });
};
