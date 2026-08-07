import { describe, it, expect } from 'vitest';
import { assessRisk, killByPid, parseName, parseSs } from './ports';

describe('assessRisk', () => {
	it('flags known system commands as system risk', () => {
		expect(assessRisk('launchd', 'root', 22).risk).toBe('system');
		expect(assessRisk('WindowServer', 'metin', 3000).risk).toBe('system');
	});

	it('flags root-owned processes as caution', () => {
		expect(assessRisk('nginx', 'root', 8080)).toEqual({
			risk: 'caution',
			note: expect.stringContaining('root')
		});
	});

	it('flags privileged ports (<1024) as caution', () => {
		expect(assessRisk('node', 'metin', 443, 'metin').risk).toBe('caution');
	});

	it("flags another user's process as caution", () => {
		expect(assessRisk('node', 'alice', 3000, 'metin')).toEqual({
			risk: 'caution',
			note: expect.stringContaining('alice')
		});
	});

	it("treats the current user's high-port process as safe", () => {
		expect(assessRisk('node', 'metin', 3000, 'metin')).toEqual({ risk: 'safe' });
	});

	it('prioritises system over root, and root over a high port', () => {
		expect(assessRisk('launchd', 'root', 80).risk).toBe('system');
		expect(assessRisk('cron', 'root', 9999, 'metin').risk).toBe('caution');
	});
});

describe('parseName', () => {
	it('parses a wildcard address', () => {
		expect(parseName('*:3000')).toEqual({ address: '*', port: 3000 });
	});

	it('parses an IPv4 address', () => {
		expect(parseName('127.0.0.1:5432')).toEqual({ address: '127.0.0.1', port: 5432 });
	});

	it('strips brackets from an IPv6 address', () => {
		expect(parseName('[::1]:6379')).toEqual({ address: '::1', port: 6379 });
	});

	it('returns null without a colon', () => {
		expect(parseName('nocolon')).toBeNull();
	});

	it('returns null for a non-numeric or non-positive port', () => {
		expect(parseName('host:abc')).toBeNull();
		expect(parseName('host:0')).toBeNull();
	});
});

describe('parseSs', () => {
	const sample = [
		'State  Recv-Q Send-Q Local Address:Port  Peer Address:Port Process',
		'LISTEN 0      128    127.0.0.1:5432       0.0.0.0:*         users:(("postgres",pid=1234,fd=7))',
		'LISTEN 0      511    0.0.0.0:8080         0.0.0.0:*         users:(("node",pid=5678,fd=20))',
		'LISTEN 0      128    [::1]:6379           [::]:*            users:(("redis-server",pid=91011,fd=6))',
		'LISTEN 0      128    *:22                 *:*'
	].join('\n');

	it('skips the header and parses each listening socket', () => {
		const rows = parseSs(sample);
		expect(rows).toEqual([
			{ address: '127.0.0.1', port: 5432, pid: 1234, command: 'postgres' },
			{ address: '0.0.0.0', port: 8080, pid: 5678, command: 'node' },
			{ address: '::1', port: 6379, pid: 91011, command: 'redis-server' },
			{ address: '*', port: 22, pid: 0, command: '' }
		]);
	});

	it('returns an empty list for header-only or empty output', () => {
		expect(parseSs('')).toEqual([]);
		expect(parseSs('State Recv-Q Send-Q Local Address:Port Peer Address:Port Process')).toEqual([]);
	});
});

describe('killByPid', () => {
	it('rejects protected / invalid pids without signalling', () => {
		for (const pid of [1, 0, -5, Number.NaN, 1.5]) {
			expect(killByPid(pid)).toEqual({ ok: false, reason: 'invalid', message: 'Invalid PID.' });
		}
	});

	it('reports not-found for a pid that does not exist', () => {
		const res = killByPid(2_000_000_000);
		expect(res.ok).toBe(false);
		if (!res.ok) expect(res.reason).toBe('not-found');
	});
});
