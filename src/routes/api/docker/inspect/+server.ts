import { json, error } from '@sveltejs/kit';
import { getContainerInspect } from '$lib/server/docker';
import { parseInput } from '$lib/server/validate';
import { containerIdQuery } from '$lib/schemas';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	const { id } = parseInput(containerIdQuery, { id: url.searchParams.get('id') ?? '' });

	const inspect = await getContainerInspect(id);
	if (!inspect) throw error(404, 'Could not inspect the container.');

	return json(inspect);
};
