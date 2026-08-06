import { json } from '@sveltejs/kit';
import { listDockerPorts } from '$lib/server/docker';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	const listing = await listDockerPorts();
	return json(listing);
};
