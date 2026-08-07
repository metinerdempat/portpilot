import { describe, it, expect } from 'vitest';
import { listPorts, listPortsLinux } from './ports';
import type { PortEntry } from '$lib/types';

// End-to-end calls that actually shell out. `listPorts` runs everywhere (lsof on
// macOS, the ss fallback on a Linux box without lsof); `listPortsLinux` is
// exercised directly on Linux — e.g. the CI ubuntu runner, which ships ss.
const expectEntry = (p: PortEntry) => {
	expect(Number.isInteger(p.port)).toBe(true);
	expect(p.port).toBeGreaterThan(0);
	expect(Number.isInteger(p.pid)).toBe(true);
	expect(['safe', 'caution', 'system']).toContain(p.risk);
	expect(p.protocol).toBe('TCP');
};

describe('listPorts (integration)', () => {
	it('returns a well-formed array without throwing', async () => {
		const ports = await listPorts();
		expect(Array.isArray(ports)).toBe(true);
		ports.forEach(expectEntry);
	});
});

describe.runIf(process.platform === 'linux')('listPortsLinux — ss path (linux only)', () => {
	it('lists sockets via ss without throwing', async () => {
		const ports = await listPortsLinux();
		expect(Array.isArray(ports)).toBe(true);
		ports.forEach(expectEntry);
	});
});
