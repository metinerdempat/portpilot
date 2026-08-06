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

export type NetworkInfo = {
	name: string;
	ip: string;
	gateway?: string;
};

export type MountInfo = {
	type: string;
	source: string;
	destination: string;
	rw: boolean;
	name?: string;
};

/** Config-level detail for one container, from `docker inspect`. */
export type ContainerInspect = {
	networks: NetworkInfo[];
	mounts: MountInfo[];
	ip?: string;
	created?: string;
	restartPolicy?: string;
	restartCount?: number;
	cmd?: string;
};
