export type ProcessInfo = {
	pid: number;
	ppid: number | null;
	cpu: number;
	mem: number;
	rssMb: number;
	uptime: string;
	command: string;
};
