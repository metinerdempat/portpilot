import { json } from '@sveltejs/kit';
import { listContainers } from '$lib/server/docker';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	return json(await listContainers());
};
