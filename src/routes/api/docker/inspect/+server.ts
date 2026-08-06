import { json, error } from '@sveltejs/kit';
import { getContainerInspect } from '$lib/server/docker';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	const id = url.searchParams.get('id') ?? '';
	if (!id) throw error(400, 'Container id is required.');

	const inspect = await getContainerInspect(id);
	if (!inspect) throw error(404, 'Could not inspect the container.');

	return json(inspect);
};
