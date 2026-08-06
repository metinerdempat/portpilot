import { json, error } from '@sveltejs/kit';
import { getProcessInfo } from '$lib/server/process';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	const pid = Number(url.searchParams.get('pid'));
	if (!Number.isInteger(pid)) throw error(400, 'Geçerli bir pid gerekli.');

	const info = await getProcessInfo(pid);
	if (!info) throw error(404, 'Süreç bilgisi alınamadı.');

	return json(info);
};
