import { json, error } from '@sveltejs/kit';
import { getProcessInfo } from '$lib/server/process';
import { parseInput } from '$lib/server/validate';
import { pidQuery } from '$lib/schemas';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	const { pid } = parseInput(pidQuery, { pid: url.searchParams.get('pid') });

	const info = await getProcessInfo(pid);
	if (!info) throw error(404, 'Could not get process info.');

	return json(info);
};
