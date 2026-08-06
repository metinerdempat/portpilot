import { json, error } from '@sveltejs/kit';
import { listDockerPorts, stopContainer } from '$lib/server/docker';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	const listing = await listDockerPorts();
	return json(listing);
};

export const POST: RequestHandler = async ({ request }) => {
	let body: { id?: unknown };
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Geçersiz istek gövdesi.');
	}

	const id = typeof body.id === 'string' ? body.id : '';
	if (!id) throw error(400, 'Konteyner kimliği gerekli.');

	const outcome = await stopContainer(id);
	if (!outcome.ok) {
		throw error(500, outcome.message);
	}
	return json({ ok: true });
};
