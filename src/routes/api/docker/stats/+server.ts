import { json, error } from '@sveltejs/kit';
import { getContainerStats } from '$lib/server/docker';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	const id = url.searchParams.get('id') ?? '';
	if (!id) throw error(400, 'Container id is required.');

	const stats = await getContainerStats(id);
	if (!stats) throw error(404, 'Could not get stats.');

	return json(stats);
};
