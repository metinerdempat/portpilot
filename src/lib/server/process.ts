import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { ProcessInfo } from '$lib/types';
import { IS_WINDOWS } from './platform';

const run = promisify(execFile);

/**
 * Windows detail via `tasklist /V` — memory + owning process. CPU %, parent and
 * full command line aren't cheaply available, so they're left blank.
 */
const getProcessInfoWindows = async (pid: number): Promise<ProcessInfo | null> => {
	try {
		const { stdout } = await run(
			'tasklist',
			['/V', '/FI', `PID eq ${pid}`, '/FO', 'CSV', '/NH'],
			{ maxBuffer: 1024 * 1024 }
		);
		const m = stdout.match(/^"([^"]*)","(\d+)","[^"]*","[^"]*","([^"]*)"/);
		if (!m) return null;
		const memKb = Number(m[3].replace(/[^\d]/g, ''));
		return {
			pid,
			ppid: null,
			cpu: 0,
			mem: 0,
			rssMb: Number.isFinite(memKb) ? Math.round((memKb / 1024) * 10) / 10 : 0,
			uptime: '—',
			command: m[1].replace(/\.exe$/i, '')
		};
	} catch {
		return null;
	}
};

/**
 * Resource usage + technical details for a single process, via `ps`.
 * `-o field=` prints the column with no header; `command` is kept last so the
 * remainder of the line (which contains spaces) is captured whole.
 */
export const getProcessInfo = async (pid: number): Promise<ProcessInfo | null> => {
	if (!Number.isInteger(pid) || pid <= 0) return null;
	if (IS_WINDOWS) return getProcessInfoWindows(pid);
	try {
		const { stdout } = await run(
			'ps',
			['-o', 'ppid=,pcpu=,pmem=,rss=,etime=,command=', '-p', String(pid)],
			{ maxBuffer: 1024 * 1024 }
		);
		const line = stdout.trim();
		if (!line) return null;

		const m = line.match(/^(\d+)\s+([\d.]+)\s+([\d.]+)\s+(\d+)\s+(\S+)\s+(.*)$/);
		if (!m) return null;

		return {
			pid,
			ppid: Number(m[1]),
			cpu: Number(m[2]),
			mem: Number(m[3]),
			rssMb: Math.round((Number(m[4]) / 1024) * 10) / 10, // ps reports RSS in KB
			uptime: m[5],
			command: m[6]
		};
	} catch {
		return null;
	}
}

export type ProcessStat = { cpu: number; mem: number; rssMb: number; command: string };

/**
 * CPU / memory / full command for many pids at once, in a single `ps` call —
 * cheap enough to run on every refresh. `command` is last (it contains spaces)
 * so the rest of the line is captured whole.
 */
export const getProcessStats = async (pids: number[]): Promise<Map<number, ProcessStat>> => {
	const out = new Map<number, ProcessStat>();
	const valid = [...new Set(pids)].filter((p) => Number.isInteger(p) && p > 0);
	if (valid.length === 0) return out;
	try {
		const { stdout } = await run(
			'ps',
			['-o', 'pid=,pcpu=,pmem=,rss=,command=', '-p', valid.join(',')],
			{ maxBuffer: 4 * 1024 * 1024 }
		);
		for (const line of stdout.split('\n')) {
			const m = line.match(/^\s*(\d+)\s+([\d.]+)\s+([\d.]+)\s+(\d+)(?:\s+(.*))?$/);
			if (!m) continue;
			out.set(Number(m[1]), {
				cpu: Number(m[2]),
				mem: Number(m[3]),
				rssMb: Math.round((Number(m[4]) / 1024) * 10) / 10,
				command: (m[5] ?? '').trim()
			});
		}
	} catch {
		/* stats are best-effort; a missing snapshot just omits the columns */
	}
	return out;
}
