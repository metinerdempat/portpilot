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

export interface ContainerStats {
	/** CPU usage, e.g. "0.15%". */
	cpu: string;
	/** Memory usage, e.g. "45MiB / 2GiB". */
	mem: string;
	/** Memory percentage, e.g. "2.2%". */
	memPerc: string;
	/** Network I/O, e.g. "1.2kB / 3.4kB". */
	net: string;
	/** Block (disk) I/O. */
	block: string;
	/** Number of processes/threads in the container. */
	pids: string;
}

/** Live resource usage for one container, via `docker stats --no-stream`. */
export async function getContainerStats(id: string): Promise<ContainerStats | null> {
	if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(id)) return null;
	try {
		const { stdout } = await run(
			'docker',
			['stats', '--no-stream', '--format', '{{json .}}', id],
			{ maxBuffer: 1024 * 1024 }
		);
		const line = stdout
			.split('\n')
			.map((l) => l.trim())
			.filter(Boolean)[0];
		if (!line) return null;

		const j = JSON.parse(line) as Record<string, string>;
		return {
			cpu: j.CPUPerc ?? '—',
			mem: j.MemUsage ?? '—',
			memPerc: j.MemPerc ?? '—',
			net: j.NetIO ?? '—',
			block: j.BlockIO ?? '—',
			pids: j.PIDs ?? '—'
		};
	} catch {
		return null;
	}
}

export type StopOutcome = { ok: true } | { ok: false; message: string };

/**
 * Stop the container that publishes a port — the Docker equivalent of killing
 * the process behind a TCP port. `docker stop` is graceful: it sends SIGTERM to
 * the container's main process, then SIGKILL after a grace period.
 */
export async function stopContainer(id: string): Promise<StopOutcome> {
	// execFile uses no shell, but reject ids that could be read as a flag ("-…").
	if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(id)) {
		return { ok: false, message: 'Invalid container id.' };
	}
	try {
		await run('docker', ['stop', id], { maxBuffer: 1024 * 1024 });
		return { ok: true };
	} catch (err) {
		const e = err as { stderr?: string; message?: string };
		return {
			ok: false,
			message: (e.stderr ?? '').toString().trim() || e.message || 'Failed to stop the container.'
		};
	}
}

function describeError(err: unknown): string {
	const e = err as { code?: string; stderr?: string; message?: string };
	if (e.code === 'ENOENT') return 'Docker CLI not found — is it installed?';
	const stderr = (e.stderr ?? '').toString();
	if (/cannot connect to the docker daemon|is the docker daemon running/i.test(stderr)) {
		return "Docker isn't running — the daemon appears to be down.";
	}
	return stderr.trim() || e.message || 'Could not reach Docker.';
}
