import { describe, it, expect } from 'vitest';
import { compactPublished, describeError, parseHealth, parsePortField, stripAnsi } from './docker';

describe('parsePortField', () => {
	it('parses a published host→container mapping', () => {
		expect(parsePortField('0.0.0.0:5432->5432/tcp')).toEqual([
			{ hostPort: 5432, containerPort: 5432, protocol: 'tcp', address: '0.0.0.0' }
		]);
	});

	it('keeps IPv4 and IPv6 mappings separate (dedup happens upstream)', () => {
		expect(parsePortField('0.0.0.0:5432->5432/tcp, :::5432->5432/tcp')).toHaveLength(2);
	});

	it('lowercases the protocol and maps differing ports', () => {
		expect(parsePortField('0.0.0.0:8080->80/TCP')).toEqual([
			{ hostPort: 8080, containerPort: 80, protocol: 'tcp', address: '0.0.0.0' }
		]);
	});

	it('skips exposed-but-unpublished ports and ranges', () => {
		expect(parsePortField('5432/tcp')).toEqual([]);
		expect(parsePortField('8000-8002->8000-8002/tcp')).toEqual([]);
	});

	it('returns an empty list for empty input', () => {
		expect(parsePortField('')).toEqual([]);
	});
});

describe('compactPublished', () => {
	it('collapses identical host/container ports and dedups IPv4/IPv6', () => {
		expect(compactPublished('0.0.0.0:5432->5432/tcp, :::5432->5432/tcp')).toBe('5432');
	});

	it('shows an arrow when host and container ports differ', () => {
		expect(compactPublished('0.0.0.0:8080->80/tcp')).toBe('8080→80');
	});

	it('joins multiple distinct mappings', () => {
		expect(compactPublished('0.0.0.0:5432->5432/tcp, 0.0.0.0:6379->6379/tcp')).toBe('5432, 6379');
	});

	it('returns an em dash when nothing is published', () => {
		expect(compactPublished('')).toBe('—');
		expect(compactPublished('5432/tcp')).toBe('—');
	});
});

describe('parseHealth', () => {
	it('extracts health from a docker status line', () => {
		expect(parseHealth('Up 3 hours (healthy)')).toBe('healthy');
		expect(parseHealth('Up 2 minutes (unhealthy)')).toBe('unhealthy');
		expect(parseHealth('Up 1 second (health: starting)')).toBe('starting');
	});

	it('returns empty when there is no health info', () => {
		expect(parseHealth('Up 3 hours')).toBe('');
		expect(parseHealth('Exited (0) 5 minutes ago')).toBe('');
	});
});

describe('stripAnsi', () => {
	it('removes ANSI color escape sequences', () => {
		expect(stripAnsi('\u001b[31mred\u001b[0m text')).toBe('red text');
	});

	it('leaves plain text untouched', () => {
		expect(stripAnsi('plain log line')).toBe('plain log line');
	});
});

describe('describeError', () => {
	it('explains a missing docker CLI (ENOENT)', () => {
		expect(describeError({ code: 'ENOENT' })).toBe('Docker CLI not found — is it installed?');
	});

	it('explains a stopped daemon from stderr', () => {
		expect(
			describeError({ stderr: 'Cannot connect to the Docker daemon at unix:///var/run/docker.sock.' })
		).toBe("Docker isn't running — the daemon appears to be down.");
	});

	it('falls back to stderr, then message, then a generic string', () => {
		expect(describeError({ stderr: 'weird failure' })).toBe('weird failure');
		expect(describeError({ message: 'boom' })).toBe('boom');
		expect(describeError({})).toBe('Could not reach Docker.');
	});
});
