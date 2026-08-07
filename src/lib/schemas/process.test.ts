import { describe, it, expect } from 'vitest';
import { killBody, pidQuery } from './process';

describe('pidQuery', () => {
	it('coerces a numeric string pid', () => {
		expect(pidQuery.parse({ pid: '4321' })).toEqual({ pid: 4321 });
	});

	it('rejects non-numeric, zero, negative, fractional and missing pids', () => {
		for (const pid of ['abc', 0, -5, 3.5, null, undefined]) {
			const r = pidQuery.safeParse({ pid });
			expect(r.success).toBe(false);
			if (!r.success) expect(r.error.issues[0].message).toBe('A valid PID is required.');
		}
	});
});

describe('killBody', () => {
	it('accepts a pid with explicit force', () => {
		expect(killBody.parse({ pid: 100, force: true })).toEqual({ pid: 100, force: true });
	});

	it('defaults force to false', () => {
		expect(killBody.parse({ pid: 100 })).toEqual({ pid: 100, force: false });
	});

	it('requires a valid pid', () => {
		const r = killBody.safeParse({ force: true });
		expect(r.success).toBe(false);
		if (!r.success) expect(r.error.issues[0].message).toBe('A valid PID is required.');
	});

	it('rejects a non-boolean force', () => {
		expect(killBody.safeParse({ pid: 100, force: 'yes' }).success).toBe(false);
	});
});
