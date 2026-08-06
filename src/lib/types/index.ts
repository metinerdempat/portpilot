// Shared types used by both the server modules and the UI.

export type View = 'tcp' | 'docker';

export type Risk = 'safe' | 'caution' | 'system';

export type PortEntry = {
	port: number;
	pid: number;
	command: string;
	user: string;
	address: string;
	protocol: 'TCP';
	risk: Risk;
	riskNote?: string;
	/** CPU % — attached from a bulk `ps` snapshot when available. */
	cpu?: number;
	/** Memory % — attached from the same `ps` snapshot. */
	mem?: number;
	/** Resident memory in MB, from the same snapshot. */
	rssMb?: number;
};

export type KillOutcome =
	| { ok: true }
	| { ok: false; reason: 'invalid' | 'not-found' | 'forbidden' | 'unknown'; message: string };

export type DockerPort = {
	hostPort: number;
	containerPort: number;
	protocol: string;
	address: string;
	container: string;
	image: string;
	containerId: string;
};

export type DockerListing = {
	available: boolean;
	reason?: string;
	ports: DockerPort[];
};

export type ContainerStats = {
	cpu: string;
	mem: string;
	memPerc: string;
	net: string;
	block: string;
	pids: string;
};

export type StopOutcome = { ok: true } | { ok: false; message: string };

export type ContainerAction = 'start' | 'stop' | 'restart';

export type ContainerInfo = {
	id: string;
	name: string;
	image: string;
	/** Raw docker state: running, exited, paused, created, restarting. */
	state: string;
	/** Human status line, e.g. "Up 3 hours (healthy)". */
	status: string;
	/** Parsed healthcheck result, if any. */
	health: '' | 'healthy' | 'unhealthy' | 'starting';
	/** Relative age, e.g. "3 hours ago". */
	createdAt: string;
	/** Compact published host→container ports, or "—" when none. */
	ports: string;
	/** Compose project label, if part of a stack. */
	project?: string;
	/** Compose service label. */
	service?: string;
	running: boolean;
};

export type ContainerListing = {
	available: boolean;
	reason?: string;
	containers: ContainerInfo[];
};

export type ProcessInfo = {
	pid: number;
	ppid: number | null;
	cpu: number;
	mem: number;
	rssMb: number;
	uptime: string;
	command: string;
};
