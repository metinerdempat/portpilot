import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { parseInput } from './validate';

describe('parseInput', () => {
	it('returns the parsed value on success', () => {
		expect(parseInput(z.object({ n: z.number() }), { n: 5 })).toEqual({ n: 5 });
	});

	it('throws a 400 with the first issue message on failure', () => {
		const schema = z.object({ id: z.string().min(1, 'Container id is required.') });
		try {
			parseInput(schema, { id: '' });
			expect.unreachable('parseInput should have thrown');
		} catch (e) {
			const err = e as { status?: number; body?: { message?: string } };
			expect(err.status).toBe(400);
			expect(err.body?.message).toBe('Container id is required.');
		}
	});
});
