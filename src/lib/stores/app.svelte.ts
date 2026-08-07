import { REFRESH_MS } from '$lib/constants';
import type {
	ContainerInfo,
	ContainerInspect,
	Detail,
	DockerPort,
	InspectDetail,
	PortEntry,
	PortSource,
	Tab,
	View
} from '$lib/types';
import { formatNow, matchContainer, matchDocker, matchPort, readErrorMessage } from '$lib/utils';

/** The whole app's state + server actions, kept out of the components. */
class AppStore {
	view = $state<Tab>('tcp');

	ports = $state<PortEntry[]>([]);
	portsReady = $state(false);
	/** The tool that produced the port list — shown in the footer. */
	portSource = $state<PortSource>('lsof');
	confirming = $state<number | null>(null);
	killing = $state<number | null>(null);

	dports = $state<DockerPort[]>([]);
	dockerReady = $state(false);
	dockerAvailable = $state(true);
	dockerReason = $state<string | null>(null);
	dconfirming = $state<string | null>(null);
	busyId = $state<string | null>(null);

	containers = $state<ContainerInfo[]>([]);
	containersReady = $state(false);
	containerAvail = $state(true);
	containerReason = $state<string | null>(null);

	expanded = $state<string[]>([]);
	details = $state<Record<string, Detail>>({});
	inspects = $state<Record<string, InspectDetail>>({});

	error = $state<string | null>(null);
	autoRefresh = $state(false);
	updatedAt = $state('');

	filter = $state('');
	filterEl = $state<HTMLInputElement | null>(null);

	readonly refreshMs = REFRESH_MS;

	visiblePorts = $derived(
		this.filter.trim() ? this.ports.filter((p) => matchPort(p, this.filter.toLowerCase())) : this.ports
	);
	visibleDports = $derived(
		this.filter.trim() ? this.dports.filter((d) => matchDocker(d, this.filter.toLowerCase())) : this.dports
	);
	visibleContainers = $derived(
		this.filter.trim()
			? this.containers.filter((c) => matchContainer(c, this.filter.toLowerCase()))
			: this.containers
	);
	riskyCount = $derived(this.ports.filter((p) => p.risk !== 'safe').length);
	runningContainers = $derived(this.containers.filter((c) => c.running).length);

	loadPorts = async () => {
		try {
			const res = await fetch('/api/ports');
			if (!res.ok) throw new Error(await readErrorMessage(res));
			const data = await res.json();
			this.ports = data.ports;
			this.portSource = data.source ?? 'lsof';
			this.error = null;
			this.updatedAt = formatNow();
		} catch (e) {
			this.error = e instanceof Error ? e.message : 'Failed to read ports.';
		} finally {
			this.portsReady = true;
		}
	};

	loadDocker = async () => {
		try {
			const res = await fetch('/api/docker');
			if (!res.ok) throw new Error(await readErrorMessage(res));
			const data = await res.json();
			this.dockerAvailable = data.available;
			this.dockerReason = data.reason ?? null;
			this.dports = data.ports;
			this.error = null;
			this.updatedAt = formatNow();
		} catch (e) {
			this.error = e instanceof Error ? e.message : 'Failed to read Docker.';
		} finally {
			this.dockerReady = true;
		}
	};

	loadContainers = async () => {
		try {
			const res = await fetch('/api/docker/containers');
			if (!res.ok) throw new Error(await readErrorMessage(res));
			const data = await res.json();
			this.containerAvail = data.available;
			this.containerReason = data.reason ?? null;
			this.containers = data.containers;
			this.error = null;
			this.updatedAt = formatNow();
		} catch (e) {
			this.error = e instanceof Error ? e.message : 'Failed to read containers.';
		} finally {
			this.containersReady = true;
		}
	};

	refresh = () => {
		if (this.view === 'tcp') return this.loadPorts();
		if (this.view === 'docker') return this.loadDocker();
		return this.loadContainers();
	};

	switchView = (v: Tab) => {
		if (this.view === v) return;
		this.view = v;
		this.confirming = null;
		this.dconfirming = null;
		this.expanded = [];
		this.error = null;
		this.refresh();
	};

	kill = async (pid: number, force = false) => {
		this.killing = pid;
		try {
			const res = await fetch('/api/kill', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ pid, force })
			});
			if (!res.ok) throw new Error(await readErrorMessage(res));
			this.confirming = null;
			await this.loadPorts();
		} catch (e) {
			this.error = e instanceof Error ? e.message : 'Failed to terminate the process.';
		} finally {
			this.killing = null;
		}
	};

	containerDo = async (id: string, action: 'start' | 'stop' | 'restart') => {
		this.busyId = id;
		try {
			const res = await fetch('/api/docker', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ id, action })
			});
			if (!res.ok) throw new Error(await readErrorMessage(res));
			this.dconfirming = null;
			await (this.view === 'containers' ? this.loadContainers() : this.loadDocker());
		} catch (e) {
			this.error = e instanceof Error ? e.message : `Failed to ${action} the container.`;
		} finally {
			this.busyId = null;
		}
	};

	copyText = (text: string) => {
		navigator.clipboard?.writeText(text);
	};

	beginAction = (kind: View, id: number | string) => {
		if (kind === 'tcp') this.confirming = id as number;
		else this.dconfirming = id as string;
	};
	cancelAction = (kind: View) => {
		if (kind === 'tcp') this.confirming = null;
		else this.dconfirming = null;
	};
	confirmAction = (kind: View, id: number | string) => {
		if (kind === 'tcp') this.kill(id as number);
		else this.containerDo(id as string, 'stop');
	};

	keyFor = (kind: View, item: PortEntry | DockerPort): string =>
		kind === 'tcp'
			? 'tcp:' + (item as PortEntry).pid + ':' + (item as PortEntry).port
			: 'docker:' +
				(item as DockerPort).containerId +
				':' +
				(item as DockerPort).hostPort +
				':' +
				(item as DockerPort).protocol;

	isOpen = (key: string) => this.expanded.includes(key);

	loadDetail = async (key: string, kind: Tab, id: number | string) => {
		this.details = { ...this.details, [key]: { loading: true, error: null, data: null } };
		try {
			const eid = encodeURIComponent(String(id));
			// tcp → process stats; docker ports → container resource stats.
			const url = kind === 'tcp' ? `/api/process?pid=${id}` : `/api/docker/stats?id=${eid}`;
			const res = await fetch(url);
			if (!res.ok) throw new Error(await readErrorMessage(res));
			const data = await res.json();
			this.details = { ...this.details, [key]: { loading: false, error: null, data } };
		} catch (e) {
			this.details = {
				...this.details,
				[key]: { loading: false, error: e instanceof Error ? e.message : 'Failed to load details.', data: null }
			};
		}
	};

	/** `docker inspect` metadata (networks, mounts) for an expanded container. */
	loadInspect = async (key: string, id: string) => {
		this.inspects = { ...this.inspects, [key]: { loading: true, error: null, data: null } };
		try {
			const res = await fetch(`/api/docker/inspect?id=${encodeURIComponent(id)}`);
			if (!res.ok) throw new Error(await readErrorMessage(res));
			const data = (await res.json()) as ContainerInspect;
			this.inspects = { ...this.inspects, [key]: { loading: false, error: null, data } };
		} catch (e) {
			this.inspects = {
				...this.inspects,
				[key]: {
					loading: false,
					error: e instanceof Error ? e.message : 'Failed to inspect the container.',
					data: null
				}
			};
		}
	};

	toggleExpand = (key: string, kind: Tab, id: number | string) => {
		if (this.isOpen(key)) {
			this.expanded = this.expanded.filter((k) => k !== key);
		} else {
			this.expanded = [...this.expanded, key];
			// Containers load config metadata here; their logs stream live in the panel.
			if (kind === 'containers') this.loadInspect(key, id as string);
			else this.loadDetail(key, kind, id);
		}
	};

	rowClick = (e: MouseEvent, key: string, kind: Tab, id: number | string) => {
		if ((e.target as HTMLElement).closest('button')) return;
		this.toggleExpand(key, kind, id);
	};

	focusRow = (i: number) => {
		(document.querySelector(`[data-idx="${i}"]`) as HTMLElement | null)?.focus();
	};

	rowKey = (e: KeyboardEvent, i: number, key: string, kind: Tab, id: number | string, locked: boolean) => {
		if (e.target !== e.currentTarget) return;
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			this.toggleExpand(key, kind, id);
		} else if (e.key === 'x') {
			if (kind !== 'containers' && !locked) {
				e.preventDefault();
				this.beginAction(kind, id);
			}
		} else if (e.key === 'ArrowDown' || e.key === 'j') {
			e.preventDefault();
			this.focusRow(i + 1);
		} else if (e.key === 'ArrowUp' || e.key === 'k') {
			e.preventDefault();
			this.focusRow(i - 1);
		}
	};

	onGlobalKey = (e: KeyboardEvent) => {
		const t = e.target as HTMLElement;
		const inInput = t.tagName === 'INPUT' || t.tagName === 'TEXTAREA';
		if (e.key === '/' && !inInput) {
			e.preventDefault();
			this.filterEl?.focus();
		} else if (e.key === 'Escape') {
			if (inInput) (t as HTMLInputElement).blur();
			else if (this.confirming !== null || this.dconfirming !== null) {
				this.confirming = null;
				this.dconfirming = null;
			} else if (this.filter) this.filter = '';
		}
	};
}

export const app = new AppStore();
