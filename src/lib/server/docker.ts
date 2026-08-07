import { execFile, spawn } from 'node:child_process';
import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import { promisify } from 'node:util';
import { CONTAINER_ID_RE } from '$lib/constants';
import type {
	ContainerAction,
	ContainerInfo,
	ContainerInspect,
	ContainerListing,
	ContainerStats,
	DockerListing,
	DockerPort,
	MountInfo,
	NetworkInfo,
	StopOutcome
} from '$lib/types';

const run = promisify(execFile);

/**
 * List every port that a *running* container publishes to the host, shaped to
 * match the TCP port list so the UI can render both the same way.
 *
 * `docker ps --format '{{json .}}'` prints one JSON object per container; its
 * `Ports` field carries the published mappings, e.g.
 * "0.0.0.0:5432->5432/tcp, :::5432->5432/tcp".
 */
export const listDockerPorts = async (): Promise<DockerListing> => {
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
const parsePortField = (
	raw: string
): Array<{ hostPort: number; containerPort: number; protocol: string; address: string }> => {
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

/** Live resource usage for one container, via `docker stats --no-stream`. */
export const getContainerStats = async (id: string): Promise<ContainerStats | null> => {
	if (!CONTAINER_ID_RE.test(id)) return null;
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

/**
 * Start, stop or restart a container. `stop` / `restart` are graceful: SIGTERM
 * to the main process, then SIGKILL after a grace period.
 */
export const containerAction = async (id: string, action: ContainerAction): Promise<StopOutcome> => {
	if (!CONTAINER_ID_RE.test(id)) return { ok: false, message: 'Invalid container id.' };
	if (action !== 'start' && action !== 'stop' && action !== 'restart') {
		return { ok: false, message: 'Invalid action.' };
	}
	try {
		await run('docker', [action, id], { maxBuffer: 1024 * 1024 });
		return { ok: true };
	} catch (err) {
		const e = err as { stderr?: string; message?: string };
		return {
			ok: false,
			message: (e.stderr ?? '').toString().trim() || e.message || `Failed to ${action} the container.`
		};
	}
}

/** Every container (running + stopped) with status, health and stack labels. */
export const listContainers = async (): Promise<ContainerListing> => {
	let stdout = '';
	try {
		const res = await run('docker', ['ps', '-a', '--no-trunc', '--format', '{{json .}}'], {
			maxBuffer: 8 * 1024 * 1024
		});
		stdout = res.stdout;
	} catch (err) {
		return { available: false, reason: describeError(err), containers: [] };
	}

	const containers: ContainerInfo[] = [];
	for (const line of stdout.split('\n')) {
		if (!line) continue;
		let r: Record<string, string>;
		try {
			r = JSON.parse(line);
		} catch {
			continue;
		}
		const state = r.State ?? '';
		const status = r.Status ?? '';
		containers.push({
			id: r.ID ?? '',
			name: r.Names ?? '',
			image: r.Image ?? '',
			state,
			status,
			health: parseHealth(status),
			createdAt: r.RunningFor ?? r.CreatedAt ?? '',
			ports: compactPublished(r.Ports ?? ''),
			project: labelValue(r.Labels ?? '', 'com.docker.compose.project'),
			service: labelValue(r.Labels ?? '', 'com.docker.compose.service'),
			running: state ? state.toLowerCase() === 'running' : /^up\b/i.test(status)
		});
	}

	// Keep compose stacks together, running containers first inside each.
	containers.sort(
		(a, b) =>
			(a.project ?? '~').localeCompare(b.project ?? '~') ||
			Number(b.running) - Number(a.running) ||
			a.name.localeCompare(b.name)
	);
	return { available: true, containers };
}

/** Minimal shape of the fields we read out of `docker inspect`'s JSON. */
type InspectRaw = {
	Created?: string;
	RestartCount?: number;
	Config?: { Cmd?: string[] | string | null };
	HostConfig?: { RestartPolicy?: { Name?: string } };
	NetworkSettings?: { Networks?: Record<string, { IPAddress?: string; Gateway?: string }> };
	Mounts?: Array<{ Type?: string; Source?: string; Destination?: string; RW?: boolean; Name?: string }>;
};

/** Config-level detail (networks, mounts, restart policy) for one container. */
export const getContainerInspect = async (id: string): Promise<ContainerInspect | null> => {
	if (!CONTAINER_ID_RE.test(id)) return null;
	try {
		const { stdout } = await run('docker', ['inspect', id], { maxBuffer: 4 * 1024 * 1024 });
		const parsed = JSON.parse(stdout) as InspectRaw[] | InspectRaw;
		const c = Array.isArray(parsed) ? parsed[0] : parsed;
		if (!c) return null;

		const networks: NetworkInfo[] = Object.entries(c.NetworkSettings?.Networks ?? {}).map(
			([name, n]) => ({ name, ip: n?.IPAddress || '—', gateway: n?.Gateway || undefined })
		);
		const mounts: MountInfo[] = (c.Mounts ?? []).map((m) => ({
			type: m.Type ?? 'volume',
			source: m.Source ?? m.Name ?? '—',
			destination: m.Destination ?? '—',
			rw: m.RW !== false,
			name: m.Name || undefined
		}));
		const policy = c.HostConfig?.RestartPolicy?.Name;
		const cmd = Array.isArray(c.Config?.Cmd) ? c.Config?.Cmd.join(' ') : (c.Config?.Cmd ?? undefined);

		return {
			networks,
			mounts,
			ip: networks.find((n) => n.ip && n.ip !== '—')?.ip,
			created: c.Created,
			restartPolicy: policy && policy !== 'no' ? policy : undefined,
			restartCount: c.RestartCount,
			cmd: cmd || undefined
		};
	} catch {
		return null;
	}
}

/**
 * Spawn a following `docker logs -f` process for live streaming. The caller
 * wires up stdout/stderr and is responsible for killing the child. Returns
 * null for an invalid id.
 */
export const streamContainerLogs = (
	id: string,
	tail = 200
): ChildProcessWithoutNullStreams | null => {
	if (!CONTAINER_ID_RE.test(id)) return null;
	const n = Number.isInteger(tail) && tail > 0 && tail <= 2000 ? tail : 200;
	return spawn('docker', ['logs', '--tail', String(n), '-f', id]);
}

const parseHealth = (status: string): ContainerInfo['health'] => {
	if (/\(healthy\)/i.test(status)) return 'healthy';
	if (/\(unhealthy\)/i.test(status)) return 'unhealthy';
	if (/health: starting/i.test(status)) return 'starting';
	return '';
}

const labelValue = (labels: string, key: string): string | undefined => {
	for (const part of labels.split(',')) {
		const eq = part.indexOf('=');
		if (eq !== -1 && part.slice(0, eq) === key) return part.slice(eq + 1);
	}
	return undefined;
}

/** Docker "Ports" string → compact "5432, 6379" / "8080→80" published list. */
const compactPublished = (raw: string): string => {
	const seen = new Set<string>();
	for (const part of raw.split(',')) {
		const seg = part.trim();
		if (!seg.includes('->')) continue;
		const [left, right] = seg.split('->');
		const rm = right.trim().match(/^(\d+)\//);
		const li = left.lastIndexOf(':');
		if (!rm || li === -1) continue;
		const host = left.slice(li + 1);
		if (!/^\d+$/.test(host)) continue;
		seen.add(host === rm[1] ? host : `${host}→${rm[1]}`);
	}
	return seen.size ? [...seen].join(', ') : '—';
}

/** Remove ANSI color/cursor escape sequences from a log chunk. */
export const stripAnsi = (raw: string): string => raw.replace(/\x1b\[[0-9;]*[A-Za-z]/g, '');

const describeError = (err: unknown): string => {
	const e = err as { code?: string; stderr?: string; message?: string };
	if (e.code === 'ENOENT') return 'Docker CLI not found — is it installed?';
	const stderr = (e.stderr ?? '').toString();
	if (/cannot connect to the docker daemon|is the docker daemon running/i.test(stderr)) {
		return "Docker isn't running — the daemon appears to be down.";
	}
	return stderr.trim() || e.message || 'Could not reach Docker.';
}
