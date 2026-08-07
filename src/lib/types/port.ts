export type Risk = 'safe' | 'caution' | 'system';

/** Which system tool produced the current TCP port list. */
export type PortSource = 'lsof' | 'ss' | 'netstat';

/** The TCP port list plus the tool that produced it. */
export type PortListing = { ports: PortEntry[]; source: PortSource };

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
	/** Full command line (path + args) — used for filtering; shown on hover. */
	fullCommand?: string;
};

export type KillOutcome =
	| { ok: true }
	| { ok: false; reason: 'invalid' | 'not-found' | 'forbidden' | 'unknown'; message: string };
