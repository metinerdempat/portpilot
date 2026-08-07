import { describe, it, expect } from 'vitest';
import { formatMem, formatNow } from './format';

describe('formatMem', () => {
	it('renders megabytes below 1 GiB rounded to whole MB', () => {
		expect(formatMem(0)).toBe('0M');
		expect(formatMem(47)).toBe('47M');
		expect(formatMem(47.6)).toBe('48M');
		expect(formatMem(1023)).toBe('1023M');
	});

	it('renders gigabytes at/above 1024 MB with one decimal', () => {
		expect(formatMem(1024)).toBe('1.0G');
		expect(formatMem(1536)).toBe('1.5G');
		expect(formatMem(8192)).toBe('8.0G');
	});

	it('returns an em dash for non-finite input', () => {
		expect(formatMem(Number.NaN)).toBe('—');
		expect(formatMem(Number.POSITIVE_INFINITY)).toBe('—');
	});
});

describe('formatNow', () => {
	it('returns a 24-hour HH:MM:SS string', () => {
		expect(formatNow()).toMatch(/^\d{2}:\d{2}:\d{2}$/);
	});
});
