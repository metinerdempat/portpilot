import { json, error } from '@sveltejs/kit';
import { getContainerStats } from '$lib/server/docker';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	const id = url.searchParams.get('id') ?? '';
	if (!id) throw error(400, 'Konteyner kimliği gerekli.');

	const stats = await getContainerStats(id);
	if (!stats) throw error(404, 'İstatistik alınamadı.');

	return json(stats);
};
