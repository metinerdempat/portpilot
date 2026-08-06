import { json, error } from '@sveltejs/kit';
import { listPorts } from '$lib/server/ports';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	try {
		const ports = await listPorts();
		return json({ ports });
	} catch (err) {
		throw error(500, err instanceof Error ? err.message : 'Could not run lsof.');
	}
};
