import { describe, it, expect } from 'vitest';
import { scopeLabel } from './scope';

describe('scopeLabel', () => {
	it('labels loopback addresses as localhost only', () => {
		expect(scopeLabel('127.0.0.1')).toBe('localhost only');
		expect(scopeLabel('::1')).toBe('localhost only');
	});

	it('labels wildcard addresses as exposed', () => {
		expect(scopeLabel('*')).toBe('exposed');
		expect(scopeLabel('0.0.0.0')).toBe('exposed');
		expect(scopeLabel('::')).toBe('exposed');
	});

	it('passes any other address through unchanged', () => {
		expect(scopeLabel('192.168.1.10')).toBe('192.168.1.10');
		expect(scopeLabel('fe80::1')).toBe('fe80::1');
	});
});
