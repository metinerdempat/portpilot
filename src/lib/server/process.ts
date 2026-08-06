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
