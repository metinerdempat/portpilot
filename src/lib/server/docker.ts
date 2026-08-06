import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);

export interface DockerPort {
	/** Port published on the host machine — the one that actually occupies a slot. */
	hostPort: number;
	/** Port inside the container it maps to. */
	containerPort: number;
	protocol: string;
	/** Host bind address, e.g. "0.0.0.0", "::", "127.0.0.1". */
	address: string;
	container: string;
	image: string;
	containerId: string;
}

export interface DockerPortListing {
	/** True when the docker CLI exists and the daemon answered. */
	available: boolean;
	/** Set when `available` is false — a short, human explanation. */
	reason?: string;
	ports: DockerPort[];
}

/**
 * List every port that a *running* container publishes to the host, shaped to
 * match the TCP port list so the UI can render both the same way.
 *
 * `docker ps --format '{{json .}}'` prints one JSON object per container; its
 * `Ports` field carries the published mappings, e.g.
 * "0.0.0.0:5432->5432/tcp, :::5432->5432/tcp".
 */
export async function listDockerPorts(): Promise<DockerPortListing> {
	let stdout = '';
	try {
		const res = await run('docker', ['ps', '--no-trunc', '--format', '{{json .}}'], {
			maxBuffer: 8 * 1024 * 1024
		});
		stdout = res.stdout;
	} catch (err) {
		return { available: false, reason: describeError(err), ports: [] };
	}

	const ports: DockerPort[] = [];
	const seen = new Set<string>();

	for (const line of stdout.split('\n')) {
		if (!line) continue;
		let record: Record<string, string>;
		try {
			record = JSON.parse(line);
		} catch {
			continue;
		}

		const container = record.Names ?? '';
		const image = record.Image ?? '';
		const containerId = record.ID ?? '';

		for (const mapping of parsePortField(record.Ports ?? '')) {
			// The same host port is usually listed twice (IPv4 + IPv6); keep one.
			const key = `${containerId}:${mapping.hostPort}:${mapping.protocol}`;
			if (seen.has(key)) continue;
			seen.add(key);
			ports.push({ ...mapping, container, image, containerId });
		}
	}

	return { available: true, ports: ports.sort((a, b) => a.hostPort - b.hostPort) };
}

/**
 * Parse a docker "Ports" string into published host→container mappings.
 * Skips exposed-but-unpublished ports (no "->") and port ranges.
 */
function parsePortField(
	raw: string
): Array<{ hostPort: number; containerPort: number; protocol: string; address: string }> {
	const out: Array<{ hostPort: number; containerPort: number; protocol: string; address: string }> = [];
	if (!raw) return out;

	for (const part of raw.split(',')) {
		const seg = part.trim();
		if (!seg.includes('->')) continue; // exposed only, not bound to the host

		const [left, right] = seg.split('->');
		const rm = right.trim().match(/^(\d+)\/(tcp|udp)/i);
		if (!rm) continue; // ranges or unexpected formats

		const li = left.lastIndexOf(':');
		if (li === -1) continue;
		const hostPort = Number(left.slice(li + 1));
		if (!Number.isInteger(hostPort)) continue; // e.g. "8000-8002" range

		const address = left.slice(0, li).replace(/^\[/, '').replace(/\]$/, '');
		out.push({
			hostPort,
			containerPort: Number(rm[1]),
			protocol: rm[2].toLowerCase(),
			address
		});
	}

	return out;
}

function describeError(err: unknown): string {
	const e = err as { code?: string; stderr?: string; message?: string };
	if (e.code === 'ENOENT') return 'Docker CLI bulunamadı — kurulu değil.';
	const stderr = (e.stderr ?? '').toString();
	if (/cannot connect to the docker daemon|is the docker daemon running/i.test(stderr)) {
		return 'Docker çalışmıyor — daemon kapalı görünüyor.';
	}
	return stderr.trim() || e.message || 'Docker’a erişilemedi.';
}
