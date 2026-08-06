import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { PRIVILEGED_PORT_MAX, SYSTEM_COMMANDS } from '$lib/constants';
import type { KillOutcome, PortEntry, Risk } from '$lib/types';
import { getProcessStats } from './process';

const run = promisify(execFile);

const CURRENT_USER = process.env.USER ?? process.env.LOGNAME ?? '';

/** Decide how dangerous it is to kill a given listener. */
const assessRisk = (command: string, user: string, port: number): { risk: Risk; note?: string } => {
	if (SYSTEM_COMMANDS.has(command)) {
		return { risk: 'system', note: `${command}: system process — killing it may disrupt the OS or a service.` };
	}
	if (user === 'root') {
		return { risk: 'caution', note: 'Owned by root — likely a system service (needs sudo to kill).' };
	}
	if (port < PRIVILEGED_PORT_MAX) {
		return { risk: 'caution', note: 'Privileged port (<1024) — usually a system/service port.' };
	}
	if (CURRENT_USER && user && user !== CURRENT_USER) {
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
export const listPorts = async (): Promise<PortEntry[]> => {
	let stdout = '';
	try {
		const res = await run('lsof', ['-nP', '+c0', '-iTCP', '-sTCP:LISTEN', '-FpcnL'], {
			maxBuffer: 4 * 1024 * 1024
		});
		stdout = res.stdout;
	} catch (err) {
		// lsof exits with status 1 when nothing matches — that's an empty list,
		// not a failure. Any partial stdout it printed is still valid.
		const e = err as { code?: number; stdout?: string };
		if (e.stdout) stdout = e.stdout;
		else if (e.code === 1) return [];
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

	return entries.sort((a, b) => a.port - b.port || a.pid - b.pid);
}

/** Parse an lsof name field such as "*:3000", "127.0.0.1:5432" or "[::1]:6379". */
const parseName = (name: string): { address: string; port: number } | null => {
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
