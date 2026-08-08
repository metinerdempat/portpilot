import { describe, it, expect } from 'vitest';
import { isLoopbackHost } from './hooks.server';

describe('isLoopbackHost', () => {
	it('accepts loopback hosts with or without a port', () => {
		for (const h of [
			'localhost',
			'localhost:5173',
			'LOCALHOST:3000',
			'127.0.0.1',
			'127.0.0.1:3000',
			'127.0.0.5',
			'[::1]',
			'[::1]:3000'
		]) {
			expect(isLoopbackHost(h)).toBe(true);
		}
	});

	it('rejects LAN, external and missing hosts', () => {
		for (const h of [
			'192.168.1.5:3000',
			'10.0.0.2',
			'0.0.0.0:3000',
			'example.com',
			'evil.com:5173',
			'portpilot.attacker.test',
			null,
			''
		]) {
			expect(isLoopbackHost(h)).toBe(false);
		}
	});
});
