import { error } from '@sveltejs/kit';
import type { z } from 'zod';

/**
 * Validate request input against a zod schema, throwing a 400 with the first
 * issue's message on failure. Returns the parsed, typed value on success.
 */
export const parseInput = <S extends z.ZodType>(schema: S, data: unknown): z.infer<S> => {
	const result = schema.safeParse(data);
	if (!result.success) {
		throw error(400, result.error.issues[0]?.message ?? 'Invalid request.');
	}
	return result.data;
};
