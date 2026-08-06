import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { ProcessInfo } from '$lib/types';

const run = promisify(execFile);

/**
 * Resource usage + technical details for a single process, via `ps`.
 * `-o field=` prints the column with no header; `command` is kept last so the
 * remainder of the line (which contains spaces) is captured whole.
 */
export async function getProcessInfo(pid: number): Promise<ProcessInfo | null> {
	if (!Number.isInteger(pid) || pid <= 0) return null;
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

export type ProcessStat = { cpu: number; mem: number; rssMb: number };

/**
 * CPU / memory for many pids at once, in a single `ps` call — cheap enough to
 * run on every refresh so the list can show live usage inline.
 */
export async function getProcessStats(pids: number[]): Promise<Map<number, ProcessStat>> {
	const out = new Map<number, ProcessStat>();
	const valid = [...new Set(pids)].filter((p) => Number.isInteger(p) && p > 0);
	if (valid.length === 0) return out;
	try {
		const { stdout } = await run('ps', ['-o', 'pid=,pcpu=,pmem=,rss=', '-p', valid.join(',')], {
			maxBuffer: 4 * 1024 * 1024
		});
		for (const line of stdout.split('\n')) {
			const m = line.trim().match(/^(\d+)\s+([\d.]+)\s+([\d.]+)\s+(\d+)$/);
			if (!m) continue;
			out.set(Number(m[1]), {
				cpu: Number(m[2]),
				mem: Number(m[3]),
				rssMb: Math.round((Number(m[4]) / 1024) * 10) / 10
			});
		}
	} catch {
		/* stats are best-effort; a missing snapshot just omits the columns */
	}
	return out;
}
