import { describe, it, expect } from 'vitest';
import { readErrorMessage } from './read-error';

describe('readErrorMessage', () => {
	it('returns the message field from a JSON error body', async () => {
		const res = new Response(JSON.stringify({ message: 'Invalid container id.' }), { status: 400 });
		expect(await readErrorMessage(res)).toBe('Invalid container id.');
	});

	it('falls back to a status message when JSON has no message field', async () => {
		const res = new Response(JSON.stringify({ ok: false }), { status: 404 });
		expect(await readErrorMessage(res)).toBe('Unexpected error (404)');
	});

	it('falls back to a status message when the body is not JSON', async () => {
		const res = new Response('not json', { status: 500 });
		expect(await readErrorMessage(res)).toBe('Unexpected error (500)');
	});
});
