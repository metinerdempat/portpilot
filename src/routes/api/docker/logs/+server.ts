import { json, error } from '@sveltejs/kit';
import { getContainerLogs } from '$lib/server/docker';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	const id = url.searchParams.get('id') ?? '';
	if (!id) throw error(400, 'Container id is required.');

	const tail = Number(url.searchParams.get('tail') ?? '200');
	const logs = await getContainerLogs(id, tail);
	if (logs === null) throw error(404, 'Could not read logs.');

	return json({ logs });
};
