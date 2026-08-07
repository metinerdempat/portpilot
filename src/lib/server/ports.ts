import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { PRIVILEGED_PORT_MAX, SYSTEM_COMMANDS } from '$lib/constants';
import type { KillOutcome, PortEntry, PortListing, Risk } from '$lib/types';
import { getProcessComm, getProcessStats } from './process';
import { IS_LINUX, IS_WINDOWS } from './platform';

const run = promisify(execFile);

const CURRENT_USER = process.env.USER ?? process.env.LOGNAME ?? '';

/** Decide how dangerous it is to kill a given listener. `currentUser` is a
 *  parameter (defaulting to the running user) so the logic stays pure/testable. */
export const assessRisk = (
	command: string,
	user: string,
	port: number,
	currentUser: string = CURRENT_USER
): { risk: Risk; note?: string } => {
	if (SYSTEM_COMMANDS.has(command)) {
		return { risk: 'system', note: `${command}: system process — killing it may disrupt the OS or a service.` };
	}
	if (user === 'root') {
		return { risk: 'caution', note: 'Owned by root — likely a system service (needs sudo to kill).' };
	}
	if (port < PRIVILEGED_PORT_MAX) {
		return { risk: 'caution', note: 'Privileged port (<1024) — usually a system/service port.' };
	}
	if (currentUser && user && user !== currentUser) {
		return { risk: 'caution', note: `Owned by another user (${user}).` };
	}
	return { risk: 'safe' };
}

/**
 * List every process that is currently *listening* on a TCP port.
 *
 * We shell out to `lsof`, which reads the kernel's open-file table, and ask for
 * machine-readable field output (`-F`). Each record looks like:
 *
 *   p12345          <- process id
 *   cnode           <- command
 *   Lmetin          <- login (user)
 *   n*:3000         <- name: address + port  (one line per listening socket)
 *
 * Flags:
 *   -nP              numeric host + port (no DNS / service-name lookups → fast + stable)
 *   +c0              never truncate the command name
 *   -iTCP            only TCP internet files
 *   -sTCP:LISTEN     only sockets in the LISTEN state
 *   -FpcnL           emit the pid, command, name and login fields
 */
export const listPorts = async (): Promise<PortListing> => {
	if (IS_WINDOWS) return { ports: await listPortsWindows(), source: 'netstat' };

	let stdout = '';
	try {
		const res = await run('lsof', ['-nP', '+c0', '-iTCP', '-sTCP:LISTEN', '-FpcnL'], {
			maxBuffer: 4 * 1024 * 1024
		});
		stdout = res.stdout;
	} catch (err) {
		// lsof exits with status 1 when nothing matches — that's an empty list,
		// not a failure. Any partial stdout it printed is still valid.
		const e = err as { code?: number | string; stdout?: string };
		if (e.stdout) stdout = e.stdout;
		else if (e.code === 1) return { ports: [], source: 'lsof' };
		// lsof isn't installed on this Linux box — fall back to ss (iproute2).
		else if (IS_LINUX && e.code === 'ENOENT') return { ports: await listPortsLinux(), source: 'ss' };
		else throw err;
	}

	const entries: PortEntry[] = [];
	const seen = new Set<string>();

	let pid = 0;
	let command = '';
	let user = '';

	for (const line of stdout.split('\n')) {
		if (!line) continue;
		const tag = line[0];
		const value = line.slice(1);

		switch (tag) {
			case 'p':
				pid = Number(value);
				command = '';
				user = '';
				break;
			case 'c':
				command = value;
				break;
			case 'L':
				user = value;
				break;
			case 'n': {
				const parsed = parseName(value);
				if (!parsed) break;
				// A process can bind the same port on both IPv4 and IPv6; collapse
				// those into a single row keyed by pid + port.
				const key = `${pid}:${parsed.port}`;
				if (seen.has(key)) break;
				seen.add(key);
				const { risk, note } = assessRisk(command, user, parsed.port);
				entries.push({
					pid,
					command,
					user,
					port: parsed.port,
					address: parsed.address,
					protocol: 'TCP',
					risk,
					riskNote: note
				});
				break;
			}
		}
	}

	// Attach a live CPU/memory snapshot so the list can show usage inline.
	const stats = await getProcessStats(entries.map((e) => e.pid));
	for (const e of entries) {
		const s = stats.get(e.pid);
		if (s) {
			e.cpu = s.cpu;
			e.mem = s.mem;
			e.rssMb = s.rssMb;
			e.fullCommand = s.command;
		}
	}

	return { ports: entries.sort((a, b) => a.port - b.port || a.pid - b.pid), source: 'lsof' };
}

/**
 * Windows: `netstat -ano -p TCP` lists listening sockets + owning PID; one
 * `tasklist` maps PID → image name and memory. CPU / full command / user are
 * omitted (not cheaply available). Killing still works through process.kill,
 * which Node maps to TerminateProcess on Windows.
 */
const listPortsWindows = async (): Promise<PortEntry[]> => {
	let netstat = '';
	try {
		netstat = (await run('netstat', ['-ano', '-p', 'TCP'], { maxBuffer: 8 * 1024 * 1024 })).stdout;
	} catch {
		return [];
	}

	const rows: { port: number; address: string; pid: number }[] = [];
	const seen = new Set<string>();
	for (const line of netstat.split('\n')) {
		const parts = line.trim().split(/\s+/);
		if (parts[0] !== 'TCP' || parts[3] !== 'LISTENING') continue;
		const local = parts[1];
		const pid = Number(parts[4]);
		const li = local.lastIndexOf(':');
		if (li === -1 || !Number.isInteger(pid)) continue;
		const port = Number(local.slice(li + 1));
		if (!Number.isInteger(port) || port <= 0) continue;
		const address = local.slice(0, li).replace(/^\[/, '').replace(/\]$/, '');
		const key = `${pid}:${port}`;
		if (seen.has(key)) continue;
		seen.add(key);
		rows.push({ port, address, pid });
	}

	// One tasklist call maps pid → image name + working-set memory.
	const meta = new Map<number, { command: string; rssMb: number }>();
	try {
		const { stdout } = await run('tasklist', ['/FO', 'CSV', '/NH'], { maxBuffer: 8 * 1024 * 1024 });
		for (const line of stdout.split('\n')) {
			const m = line.match(/^"([^"]*)","(\d+)","[^"]*","[^"]*","([^"]*)"/);
			if (!m) continue;
			const memKb = Number(m[3].replace(/[^\d]/g, ''));
			meta.set(Number(m[2]), {
				command: m[1].replace(/\.exe$/i, ''),
				rssMb: Number.isFinite(memKb) ? Math.round((memKb / 1024) * 10) / 10 : 0
			});
		}
	} catch {
		/* names / memory are best-effort */
	}

	const entries = rows.map((r): PortEntry => {
		const info = meta.get(r.pid);
		const command = info?.command ?? '';
		const { risk, note } = assessRisk(command, '', r.port);
		return {
			pid: r.pid,
			command,
			user: '',
			port: r.port,
			address: r.address,
			protocol: 'TCP',
			risk,
			riskNote: note,
			rssMb: info?.rssMb
		};
	});

	return entries.sort((a, b) => a.port - b.port || a.pid - b.pid);
};

/**
 * Linux fallback for when `lsof` isn't installed: `ss` (iproute2) is present on
 * essentially every modern Linux and lists listening TCP sockets with the
 * owning process. `ss` doesn't expose the socket's user, so risk falls back to
 * command + port; CPU / memory / full command are filled in from `ps`.
 */
export const listPortsLinux = async (): Promise<PortEntry[]> => {
	let stdout = '';
	try {
		// -t TCP, -l listening, -n numeric, -p show process. No -H (older ss lacks
		// it); the header line is skipped by the LISTEN-prefix filter in parseSs.
		stdout = (await run('ss', ['-tlnp'], { maxBuffer: 8 * 1024 * 1024 })).stdout;
	} catch {
		return [];
	}

	const rows = parseSs(stdout);
	const stats = await getProcessStats(rows.map((r) => r.pid).filter((p) => p > 0));

	const entries = rows.map((r): PortEntry => {
		const s = stats.get(r.pid);
		const command = r.command || (s?.command ?? '').split(/\s+/)[0];
		const { risk, note } = assessRisk(command, '', r.port);
		return {
			pid: r.pid,
			command,
			user: '',
			port: r.port,
			address: r.address,
			protocol: 'TCP',
			risk,
			riskNote: note,
			cpu: s?.cpu,
			mem: s?.mem,
			rssMb: s?.rssMb,
			fullCommand: s?.command
		};
	});

	return entries.sort((a, b) => a.port - b.port || a.pid - b.pid);
};

/**
 * Parse `ss -tlnp` output into listening-socket rows. Each data line looks like:
 *   LISTEN 0 128 127.0.0.1:5432 0.0.0.0:* users:(("postgres",pid=1234,fd=7))
 * The process column is absent for sockets the current user can't inspect.
 */
export const parseSs = (
	stdout: string
): Array<{ address: string; port: number; pid: number; command: string }> => {
	const out: Array<{ address: string; port: number; pid: number; command: string }> = [];
	const seen = new Set<string>();

	for (const raw of stdout.split('\n')) {
		const line = raw.trim();
		if (!/^LISTEN\b/i.test(line)) continue; // skips the header + non-listening rows

		const cols = line.split(/\s+/);
		const local = cols[3]; // State Recv-Q Send-Q Local-Address:Port …
		if (!local) continue;

		const li = local.lastIndexOf(':');
		if (li === -1) continue;
		const port = Number(local.slice(li + 1));
		if (!Number.isInteger(port) || port <= 0) continue;

		const address = local.slice(0, li).replace(/^\[/, '').replace(/\]$/, '');
		const proc = cols.slice(5).join(' ');
		const pid = Number(proc.match(/pid=(\d+)/)?.[1] ?? 0);
		const command = proc.match(/"([^"]+)"/)?.[1] ?? '';

		const key = `${pid}:${port}`;
		if (seen.has(key)) continue;
		seen.add(key);
		out.push({ address, port, pid, command });
	}

	return out;
}

/** Parse an lsof name field such as "*:3000", "127.0.0.1:5432" or "[::1]:6379". */
export const parseName = (name: string): { address: string; port: number } | null => {
	const idx = name.lastIndexOf(':');
	if (idx === -1) return null;
	const port = Number(name.slice(idx + 1));
	if (!Number.isInteger(port) || port <= 0) return null;
	const address = name.slice(0, idx).replace(/^\[/, '').replace(/\]$/, '');
	return { address, port };
}

/**
 * Send a termination signal to a process.
 *
 * SIGTERM (default) asks the process to shut down cleanly — it can flush state
 * and release the port gracefully. SIGKILL (`force`) is the non-negotiable
 * version the kernel applies immediately; use it only when SIGTERM is ignored.
 */
export const killByPid = (pid: number, force = false): KillOutcome => {
	// Guard against pid 1 (init/launchd) and nonsense values.
	if (!Number.isInteger(pid) || pid <= 1) {
		return { ok: false, reason: 'invalid', message: 'Invalid PID.' };
	}

	try {
		process.kill(pid, force ? 'SIGKILL' : 'SIGTERM');
		return { ok: true };
	} catch (err) {
		const e = err as NodeJS.ErrnoException;
		if (e.code === 'ESRCH') {
			return { ok: false, reason: 'not-found', message: 'Process already gone.' };
		}
		if (e.code === 'EPERM') {
			return {
				ok: false,
				reason: 'forbidden',
				message: 'Permission denied — this process belongs to another user (may need sudo).'
			};
		}
		return { ok: false, reason: 'unknown', message: e.message };
	}
}

/**
 * True when a command name is one of the OS-critical processes we refuse to
 * kill. Accepts a full path (macOS `ps comm`) or a short name (Linux/Windows)
 * and matches on the basename against SYSTEM_COMMANDS.
 */
export const isProtectedProcessName = (name: string): boolean => {
	const base = name.trim().split('/').pop() ?? '';
	return base !== '' && SYSTEM_COMMANDS.has(base);
}

/**
 * Kill the process on a port — but refuse OS-critical processes server-side,
 * even if a request bypasses the UI's lock (defence in depth). Resolves the
 * command name first, then defers the actual signal to killByPid.
 */
export const killPort = async (pid: number, force = false): Promise<KillOutcome> => {
	if (!Number.isInteger(pid) || pid <= 1) {
		return { ok: false, reason: 'invalid', message: 'Invalid PID.' };
	}
	const comm = await getProcessComm(pid);
	if (isProtectedProcessName(comm)) {
		return {
			ok: false,
			reason: 'forbidden',
			message: `Refusing to kill ${comm.split('/').pop()} — protected system process.`
		};
	}
	return killByPid(pid, force);
}
