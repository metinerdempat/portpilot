import { json, error } from '@sveltejs/kit';
import { getContainerStats } from '$lib/server/docker';
import { parseInput } from '$lib/server/validate';
import { containerIdQuery } from '$lib/schemas';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	const { id } = parseInput(containerIdQuery, { id: url.searchParams.get('id') ?? '' });

	const stats = await getContainerStats(id);
	if (!stats) throw error(404, 'Could not get stats.');

	return json(stats);
};
