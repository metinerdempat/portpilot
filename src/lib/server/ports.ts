import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);

export interface PortEntry {
	/** The TCP port being listened on, e.g. 3000. */
	port: number;
	/** Process id that owns the socket. */
	pid: number;
	/** Executable / command name, e.g. "node". */
	command: string;
	/** Login name of the owning user. */
	user: string;
	/** Bind address, e.g. "*", "127.0.0.1", "::1". */
	address: string;
	protocol: 'TCP';
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
export async function listPorts(): Promise<PortEntry[]> {
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
				entries.push({
					pid,
					command,
					user,
					port: parsed.port,
					address: parsed.address,
					protocol: 'TCP'
				});
				break;
			}
		}
	}

	return entries.sort((a, b) => a.port - b.port || a.pid - b.pid);
}

/** Parse an lsof name field such as "*:3000", "127.0.0.1:5432" or "[::1]:6379". */
function parseName(name: string): { address: string; port: number } | null {
	const idx = name.lastIndexOf(':');
	if (idx === -1) return null;
	const port = Number(name.slice(idx + 1));
	if (!Number.isInteger(port) || port <= 0) return null;
	const address = name.slice(0, idx).replace(/^\[/, '').replace(/\]$/, '');
	return { address, port };
}

export type KillOutcome =
	| { ok: true }
	| { ok: false; reason: 'invalid' | 'not-found' | 'forbidden' | 'unknown'; message: string };

/**
 * Send a termination signal to a process.
 *
 * SIGTERM (default) asks the process to shut down cleanly — it can flush state
 * and release the port gracefully. SIGKILL (`force`) is the non-negotiable
 * version the kernel applies immediately; use it only when SIGTERM is ignored.
 */
export function killByPid(pid: number, force = false): KillOutcome {
	// Guard against pid 1 (init/launchd) and nonsense values.
	if (!Number.isInteger(pid) || pid <= 1) {
		return { ok: false, reason: 'invalid', message: 'Geçersiz PID.' };
	}

	try {
		process.kill(pid, force ? 'SIGKILL' : 'SIGTERM');
		return { ok: true };
	} catch (err) {
		const e = err as NodeJS.ErrnoException;
		if (e.code === 'ESRCH') {
			return { ok: false, reason: 'not-found', message: 'Süreç zaten kapanmış.' };
		}
		if (e.code === 'EPERM') {
			return {
				ok: false,
				reason: 'forbidden',
				message: 'İzin yok — bu süreç başka bir kullanıcıya ait (sudo gerekebilir).'
			};
		}
		return { ok: false, reason: 'unknown', message: e.message };
	}
}
