import { describe, it, expect } from 'vitest';
import { containerIdQuery, dockerActionBody, logStreamQuery } from './docker';

describe('containerIdQuery', () => {
	it('accepts a valid id', () => {
		expect(containerIdQuery.parse({ id: 'url_shortener_postgres' })).toEqual({
			id: 'url_shortener_postgres'
		});
	});

	it('reports an empty id as required', () => {
		const r = containerIdQuery.safeParse({ id: '' });
		expect(r.success).toBe(false);
		if (!r.success) expect(r.error.issues[0].message).toBe('Container id is required.');
	});

	it('treats a missing id as required', () => {
		const r = containerIdQuery.safeParse({});
		expect(r.success).toBe(false);
		if (!r.success) expect(r.error.issues[0].message).toBe('Container id is required.');
	});

	it('rejects ids with shell-unsafe characters or a leading dash', () => {
		for (const id of ['bad;rm', '-flag', 'a b', 'x$(y)', './etc']) {
			const r = containerIdQuery.safeParse({ id });
			expect(r.success).toBe(false);
			if (!r.success) expect(r.error.issues[0].message).toBe('Invalid container id.');
		}
	});
});

describe('dockerActionBody', () => {
	it('defaults the action to stop when omitted', () => {
		expect(dockerActionBody.parse({ id: 'abc' })).toEqual({ id: 'abc', action: 'stop' });
	});

	it('accepts start / stop / restart', () => {
		for (const action of ['start', 'stop', 'restart'] as const) {
			expect(dockerActionBody.parse({ id: 'abc', action })).toEqual({ id: 'abc', action });
		}
	});

	it('rejects an unknown action', () => {
		expect(dockerActionBody.safeParse({ id: 'abc', action: 'nuke' }).success).toBe(false);
	});

	it('requires an id', () => {
		const r = dockerActionBody.safeParse({ action: 'stop' });
		expect(r.success).toBe(false);
		if (!r.success) expect(r.error.issues[0].message).toBe('Container id is required.');
	});
});

describe('logStreamQuery', () => {
	it('coerces a valid tail', () => {
		expect(logStreamQuery.parse({ id: 'abc', tail: '500' })).toEqual({ id: 'abc', tail: 500 });
	});

	it('falls back to 200 for a missing, null, non-numeric or out-of-range tail', () => {
		expect(logStreamQuery.parse({ id: 'abc' }).tail).toBe(200);
		expect(logStreamQuery.parse({ id: 'abc', tail: null }).tail).toBe(200);
		expect(logStreamQuery.parse({ id: 'abc', tail: 'x' }).tail).toBe(200);
		expect(logStreamQuery.parse({ id: 'abc', tail: '99999' }).tail).toBe(200);
		expect(logStreamQuery.parse({ id: 'abc', tail: '0' }).tail).toBe(200);
	});

	it('still validates the id', () => {
		expect(logStreamQuery.safeParse({ id: 'bad;x', tail: '10' }).success).toBe(false);
	});
});
