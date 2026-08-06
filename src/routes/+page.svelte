<script lang="ts">
	import { onMount } from 'svelte';
	import type { ContainerInfo, DockerPort, PortEntry, View } from '$lib/types';
	import { REFRESH_MS, SKELETON_DOCKER_WIDTHS, SKELETON_TCP_WIDTHS } from '$lib/constants';
	import { formatMem, formatNow, readErrorMessage, scopeLabel } from '$lib/utils';

	type Detail = {
		loading: boolean;
		error: string | null;
		data: Record<string, string | number | null> | null;
	};
	type Tab = View | 'containers';

	let view = $state<Tab>('tcp');

	let ports = $state<PortEntry[]>([]);
	let portsReady = $state(false);
	let confirming = $state<number | null>(null);
	let killing = $state<number | null>(null);

	let dports = $state<DockerPort[]>([]);
	let dockerReady = $state(false);
	let dockerAvailable = $state(true);
	let dockerReason = $state<string | null>(null);
	let dconfirming = $state<string | null>(null);
	let busyId = $state<string | null>(null); // container action in flight (stop/start/restart)

	// ---- containers ----
	let containers = $state<ContainerInfo[]>([]);
	let containersReady = $state(false);
	let containerAvail = $state(true);
	let containerReason = $state<string | null>(null);

	let expanded = $state<string[]>([]);
	let details = $state<Record<string, Detail>>({});

	let error = $state<string | null>(null);
	let autoRefresh = $state(false);
	let updatedAt = $state('');

	// ---- filter + keyboard ----
	let filter = $state('');
	let filterEl = $state<HTMLInputElement | null>(null);

	let visiblePorts = $derived(
		filter.trim() ? ports.filter((p) => matchPort(p, filter.toLowerCase())) : ports
	);
	let visibleDports = $derived(
		filter.trim() ? dports.filter((d) => matchDocker(d, filter.toLowerCase())) : dports
	);
	let visibleContainers = $derived(
		filter.trim() ? containers.filter((c) => matchContainer(c, filter.toLowerCase())) : containers
	);
	let riskyCount = $derived(ports.filter((p) => p.risk !== 'safe').length);
	let runningContainers = $derived(containers.filter((c) => c.running).length);

	function matchPort(p: PortEntry, q: string) {
		return String(p.port).includes(q) || p.command.toLowerCase().includes(q) || p.user.toLowerCase().includes(q);
	}
	function matchDocker(d: DockerPort, q: string) {
		return (
			String(d.hostPort).includes(q) ||
			String(d.containerPort).includes(q) ||
			d.container.toLowerCase().includes(q) ||
			d.image.toLowerCase().includes(q)
		);
	}
	function matchContainer(c: ContainerInfo, q: string) {
		return (
			c.name.toLowerCase().includes(q) ||
			c.image.toLowerCase().includes(q) ||
			(c.project ?? '').toLowerCase().includes(q) ||
			(c.service ?? '').toLowerCase().includes(q) ||
			c.status.toLowerCase().includes(q) ||
			c.ports.toLowerCase().includes(q)
		);
	}

	async function loadPorts() {
		try {
			const res = await fetch('/api/ports');
			if (!res.ok) throw new Error(await readErrorMessage(res));
			ports = (await res.json()).ports;
			error = null;
			updatedAt = formatNow();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to read ports.';
		} finally {
			portsReady = true;
		}
	}

	async function loadDocker() {
		try {
			const res = await fetch('/api/docker');
			if (!res.ok) throw new Error(await readErrorMessage(res));
			const data = await res.json();
			dockerAvailable = data.available;
			dockerReason = data.reason ?? null;
			dports = data.ports;
			error = null;
			updatedAt = formatNow();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to read Docker.';
		} finally {
			dockerReady = true;
		}
	}

	async function loadContainers() {
		try {
			const res = await fetch('/api/docker/containers');
			if (!res.ok) throw new Error(await readErrorMessage(res));
			const data = await res.json();
			containerAvail = data.available;
			containerReason = data.reason ?? null;
			containers = data.containers;
			error = null;
			updatedAt = formatNow();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to read containers.';
		} finally {
			containersReady = true;
		}
	}

	function refresh() {
		if (view === 'tcp') return loadPorts();
		if (view === 'docker') return loadDocker();
		return loadContainers();
	}

	function switchView(v: Tab) {
		if (view === v) return;
		view = v;
		confirming = null;
		dconfirming = null;
		expanded = [];
		error = null;
		refresh();
	}

	async function kill(pid: number, force = false) {
		killing = pid;
		try {
			const res = await fetch('/api/kill', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ pid, force })
			});
			if (!res.ok) throw new Error(await readErrorMessage(res));
			confirming = null;
			await loadPorts();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to terminate the process.';
		} finally {
			killing = null;
		}
	}

	async function containerDo(id: string, action: 'start' | 'stop' | 'restart') {
		busyId = id;
		try {
			const res = await fetch('/api/docker', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ id, action })
			});
			if (!res.ok) throw new Error(await readErrorMessage(res));
			dconfirming = null;
			await (view === 'containers' ? loadContainers() : loadDocker());
		} catch (e) {
			error = e instanceof Error ? e.message : `Failed to ${action} the container.`;
		} finally {
			busyId = null;
		}
	}

	function copyText(text: string) {
		navigator.clipboard?.writeText(text);
	}

	function beginAction(kind: View, id: number | string) {
		if (kind === 'tcp') confirming = id as number;
		else dconfirming = id as string;
	}
	function cancelAction(kind: View) {
		if (kind === 'tcp') confirming = null;
		else dconfirming = null;
	}
	function confirmAction(kind: View, id: number | string) {
		if (kind === 'tcp') kill(id as number);
		else containerDo(id as string, 'stop');
	}

	// ---- expand / detail ----
	function keyFor(kind: View, item: PortEntry | DockerPort): string {
		return kind === 'tcp'
			? 'tcp:' + (item as PortEntry).pid + ':' + (item as PortEntry).port
			: 'docker:' + (item as DockerPort).containerId + ':' + (item as DockerPort).hostPort + ':' + (item as DockerPort).protocol;
	}
	function isOpen(key: string) {
		return expanded.includes(key);
	}

	async function loadDetail(key: string, kind: Tab, id: number | string) {
		details = { ...details, [key]: { loading: true, error: null, data: null } };
		try {
			const eid = encodeURIComponent(String(id));
			const url =
				kind === 'tcp'
					? `/api/process?pid=${id}`
					: kind === 'docker'
						? `/api/docker/stats?id=${eid}`
						: `/api/docker/logs?id=${eid}&tail=200`;
			const res = await fetch(url);
			if (!res.ok) throw new Error(await readErrorMessage(res));
			const data = await res.json();
			details = { ...details, [key]: { loading: false, error: null, data } };
		} catch (e) {
			details = {
				...details,
				[key]: { loading: false, error: e instanceof Error ? e.message : 'Failed to load details.', data: null }
			};
		}
	}

	function toggleExpand(key: string, kind: Tab, id: number | string) {
		if (isOpen(key)) {
			expanded = expanded.filter((k) => k !== key);
		} else {
			expanded = [...expanded, key];
			loadDetail(key, kind, id);
		}
	}

	function rowClick(e: MouseEvent, key: string, kind: Tab, id: number | string) {
		if ((e.target as HTMLElement).closest('button')) return;
		toggleExpand(key, kind, id);
	}

	function focusRow(i: number) {
		(document.querySelector(`[data-idx="${i}"]`) as HTMLElement | null)?.focus();
	}

	// Per-row keys: ↑↓ / j k move focus, ↵ expands, x kills — when the row itself
	// (not an inner button) holds focus.
	function rowKey(e: KeyboardEvent, i: number, key: string, kind: Tab, id: number | string, locked: boolean) {
		if (e.target !== e.currentTarget) return;
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			toggleExpand(key, kind, id);
		} else if (e.key === 'x') {
			if (kind !== 'containers' && !locked) {
				e.preventDefault();
				beginAction(kind, id);
			}
		} else if (e.key === 'ArrowDown' || e.key === 'j') {
			e.preventDefault();
			focusRow(i + 1);
		} else if (e.key === 'ArrowUp' || e.key === 'k') {
			e.preventDefault();
			focusRow(i - 1);
		}
	}

	function onGlobalKey(e: KeyboardEvent) {
		const t = e.target as HTMLElement;
		const inInput = t.tagName === 'INPUT' || t.tagName === 'TEXTAREA';
		if (e.key === '/' && !inInput) {
			e.preventDefault();
			filterEl?.focus();
		} else if (e.key === 'Escape') {
			if (inInput) (t as HTMLInputElement).blur();
			else if (confirming !== null || dconfirming !== null) {
				confirming = null;
				dconfirming = null;
			} else if (filter) filter = '';
		}
	}

	onMount(refresh);

	$effect(() => {
		if (!autoRefresh) return;
		const id = setInterval(refresh, REFRESH_MS);
		return () => clearInterval(id);
	});
</script>

<svelte:window onkeydown={onGlobalKey} />

<svelte:head>
	<title>portpilot — ports & docker</title>
</svelte:head>

{#snippet chevron()}
	<svg class="chev" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
		<path d="M9 5l7 7-7 7" />
	</svg>
{/snippet}

{#snippet powerIcon()}
	<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
		<path d="M12 4v8" /><path d="M7.6 7.2a7 7 0 1 0 8.8 0" />
	</svg>
{/snippet}

{#snippet stopIcon()}
	<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true">
		<rect x="6" y="6" width="12" height="12" rx="2.5" />
	</svg>
{/snippet}

{#snippet zapIcon()}
	<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true">
		<path d="M13 2L4 14h6l-1 8 9-12h-6z" />
	</svg>
{/snippet}

{#snippet xIcon()}
	<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
		<path d="M6 6l12 12M18 6L6 18" />
	</svg>
{/snippet}

{#snippet lockIcon()}
	<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
		<rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" />
	</svg>
{/snippet}

{#snippet copyIcon()}
	<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
		<rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" />
	</svg>
{/snippet}

{#snippet restartIcon()}
	<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
		<path d="M3 12a9 9 0 1 0 2.6-6.4" /><path d="M3 4v5h5" />
	</svg>
{/snippet}

{#snippet playIcon()}
	<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true">
		<path d="M7 5v14l11-7z" />
	</svg>
{/snippet}

{#snippet actionCell(a: { kind: View; id: number | string; locked: boolean; copy?: number })}
	{@const active = a.kind === 'tcp' ? confirming === a.id : dconfirming === a.id}
	{@const busy = a.kind === 'tcp' ? killing === a.id : busyId === a.id}
	<span class="cell actions">
		{#if a.locked}
			<span class="icon-btn locked" role="img" aria-label="Protected system process" data-tip="Protected — can’t kill">
				{@render lockIcon()}
			</span>
		{:else if active}
			<span class="confirm">
				<button class="kill-btn" onclick={() => confirmAction(a.kind, a.id)} disabled={busy}>
					{busy ? '…' : a.kind === 'tcp' ? 'Kill' : 'Stop'}
				</button>
				{#if a.kind === 'tcp'}
					<button class="icon-btn force" onclick={() => kill(a.id as number, true)} disabled={busy} data-tip="Force · SIGKILL" aria-label="Force kill">
						{@render zapIcon()}
					</button>
				{/if}
				<button class="icon-btn" onclick={() => cancelAction(a.kind)} disabled={busy} data-tip="Cancel" aria-label="Cancel">
					{@render xIcon()}
				</button>
			</span>
		{:else}
			{#if a.copy != null}
				<button class="icon-btn reveal" onclick={() => copyText('localhost:' + a.copy)} data-tip={'Copy localhost:' + a.copy} aria-label="Copy address">
					{@render copyIcon()}
				</button>
			{/if}
			{#if a.kind === 'docker'}
				<button class="icon-btn reveal" onclick={() => containerDo(a.id as string, 'restart')} disabled={busy} data-tip="Restart container" aria-label="Restart container">
					{@render restartIcon()}
				</button>
			{/if}
			<button class="icon-btn danger reveal" onclick={() => beginAction(a.kind, a.id)} data-tip={a.kind === 'tcp' ? 'Kill port' : 'Stop container'} aria-label={a.kind === 'tcp' ? 'Kill port' : 'Stop container'}>
				{#if a.kind === 'tcp'}{@render powerIcon()}{:else}{@render stopIcon()}{/if}
			</button>
		{/if}
	</span>
{/snippet}

{#snippet detailPanel(key: string, kind: View)}
	{@const d = details[key]}
	<div class="detail">
		{#if !d || d.loading}
			<div class="facts">
				{#each [70, 54, 88, 60] as w (w)}
					<div class="fact"><span class="sk" style="width: 34px; height: 8px"></span><span class="sk" style="width: {w}px; height: 9px"></span></div>
				{/each}
			</div>
		{:else if d.error}
			<p class="detail-error">{d.error}</p>
		{:else if kind === 'tcp' && d.data}
			{@const x = d.data}
			<div class="facts">
				<div class="fact"><dt>Memory</dt><dd>{x.rssMb} MB · {x.mem}%</dd></div>
				<div class="fact"><dt>Uptime</dt><dd>{x.uptime}</dd></div>
				<div class="fact"><dt>Parent</dt><dd>PID {x.ppid}</dd></div>
			</div>
			<div class="cmdline"><dt>Command</dt><code>{x.command}</code></div>
		{:else if d.data}
			{@const x = d.data}
			<div class="facts">
				<div class="fact"><dt>CPU</dt><dd>{x.cpu}</dd></div>
				<div class="fact"><dt>Memory</dt><dd>{x.mem} · {x.memPerc}</dd></div>
				<div class="fact"><dt>Network I/O</dt><dd>{x.net}</dd></div>
				<div class="fact"><dt>Disk I/O</dt><dd>{x.block}</dd></div>
				<div class="fact"><dt>Processes</dt><dd>{x.pids}</dd></div>
			</div>
		{/if}
	</div>
{/snippet}

{#snippet containerActions(c: ContainerInfo)}
	{@const busy = busyId === c.id}
	<span class="cell actions">
		{#if dconfirming === c.id}
			<span class="confirm">
				<button class="kill-btn" onclick={() => containerDo(c.id, 'stop')} disabled={busy}>
					{busy ? '…' : 'Stop'}
				</button>
				<button class="icon-btn" onclick={() => (dconfirming = null)} disabled={busy} data-tip="Cancel" aria-label="Cancel">
					{@render xIcon()}
				</button>
			</span>
		{:else if c.running}
			<button class="icon-btn reveal" onclick={() => containerDo(c.id, 'restart')} disabled={busy} data-tip="Restart" aria-label="Restart">
				{@render restartIcon()}
			</button>
			<button class="icon-btn danger reveal" onclick={() => (dconfirming = c.id)} disabled={busy} data-tip="Stop" aria-label="Stop">
				{@render stopIcon()}
			</button>
		{:else}
			<button class="icon-btn go" onclick={() => containerDo(c.id, 'start')} disabled={busy} data-tip="Start" aria-label="Start">
				{@render playIcon()}
			</button>
		{/if}
	</span>
{/snippet}

{#snippet logsPanel(key: string)}
	{@const d = details[key]}
	<div class="detail logs">
		{#if !d || d.loading}
			<div class="logskel">
				{#each [92, 74, 86, 60, 80] as w (w)}<span class="sk" style="width: {w}%; height: 9px"></span>{/each}
			</div>
		{:else if d.error}
			<p class="detail-error">{d.error}</p>
		{:else}
			<pre class="logbox">{d.data?.logs || '(no output)'}</pre>
		{/if}
	</div>
{/snippet}

<div class="app">
	<header class="topbar">
		<div class="brand">
			<span class="pulse" aria-hidden="true"></span>
			<span class="name">portpilot</span>
		</div>
		<nav class="views" aria-label="View">
			<button class:on={view === 'tcp'} onclick={() => switchView('tcp')}>TCP</button>
			<button class:on={view === 'docker'} onclick={() => switchView('docker')}>Docker</button>
			<button class:on={view === 'containers'} onclick={() => switchView('containers')}>Containers</button>
		</nav>
		<div class="grow"></div>
		<div class="stat" aria-live="polite">
			{#if view === 'tcp' && portsReady}
				<span class="n">{ports.length}</span> ports{#if riskyCount > 0}<span class="sep">·</span><span class="risky">{riskyCount} risky</span>{/if}
			{:else if view === 'docker' && dockerReady && dockerAvailable}
				<span class="n">{dports.length}</span> published
			{:else if view === 'containers' && containersReady && containerAvail}
				<span class="n">{runningContainers}</span> / {containers.length} up
			{/if}
		</div>
		{#if updatedAt}<time class="clock">{updatedAt}</time>{/if}
		<label class="auto" data-tip="Refresh every 3s">
			<input type="checkbox" bind:checked={autoRefresh} />
			<span>auto</span>
		</label>
		<button class="tbtn" onclick={refresh} data-tip="Refresh now">Refresh</button>
	</header>

	<div class="filterbar">
		<svg class="search" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
			<circle cx="11" cy="11" r="7" /><path d="M20 20l-3.2-3.2" />
		</svg>
		<input
			bind:this={filterEl}
			bind:value={filter}
			class="filter"
			type="text"
			placeholder="Filter by port, process, container…"
			spellcheck="false"
			autocomplete="off"
			aria-label="Filter"
		/>
		{#if filter}
			<button class="clear" onclick={() => (filter = '')} aria-label="Clear filter">{@render xIcon()}</button>
		{:else}
			<kbd class="slash">/</kbd>
		{/if}
	</div>

	{#if error}
		<div class="banner" role="alert">{error}</div>
	{/if}

	<main class="list">
		{#if view === 'tcp'}
			<div class="row rhead" role="row">
				<span class="cell"></span>
				<span class="cell">Port</span>
				<span class="cell">Process</span>
				<span class="cell r">CPU</span>
				<span class="cell r">Mem</span>
				<span class="cell r">PID</span>
				<span class="cell"></span>
				<span class="cell"></span>
			</div>

			{#if !portsReady}
				{#each SKELETON_TCP_WIDTHS as w (w)}
					<div class="row rtcp sk-row" aria-hidden="true">
						<span class="cell"><span class="dot" style="background: var(--sk-hi)"></span></span>
						<span class="cell"><span class="sk" style="width: 34px"></span></span>
						<span class="cell"><span class="sk" style="width: {w}%"></span></span>
						<span class="cell r"><span class="sk" style="width: 28px"></span></span>
						<span class="cell r"><span class="sk" style="width: 28px"></span></span>
						<span class="cell r"><span class="sk" style="width: 40px"></span></span>
						<span class="cell"></span>
						<span class="cell"></span>
					</div>
				{/each}
			{:else if visiblePorts.length === 0}
				<p class="empty">{filter ? 'No ports match the filter.' : 'No listening TCP ports. All quiet.'}</p>
			{:else}
				{#each visiblePorts as p, i (p.pid + ':' + p.port)}
					{@const key = keyFor('tcp', p)}
					<div
						class="row rtcp"
						class:open={isOpen(key)}
						data-risk={p.risk}
						data-idx={i}
						role="row"
						tabindex="0"
						onclick={(e) => rowClick(e, key, 'tcp', p.pid)}
						onkeydown={(e) => rowKey(e, i, key, 'tcp', p.pid, p.risk === 'system')}
					>
						<span class="cell"><span class="dot" data-risk={p.risk} title={p.riskNote}></span></span>
						<span class="cell port">{p.port}</span>
						<span class="cell proc">
							<span class="cmd">{p.command || '—'}</span>
							<span class="scope">{scopeLabel(p.address)}</span>
							{#if p.risk !== 'safe'}<span class="tag t-{p.risk}">{p.risk}</span>{/if}
						</span>
						<span class="cell r metric">{p.cpu != null ? p.cpu + '%' : '·'}</span>
						<span class="cell r metric">{p.rssMb != null ? formatMem(p.rssMb) : '·'}</span>
						<span class="cell r pid">{p.pid}</span>
						{@render actionCell({ kind: 'tcp', id: p.pid, locked: p.risk === 'system' })}
						<span class="cell chevcell">{@render chevron()}</span>
					</div>
					{#if isOpen(key)}{@render detailPanel(key, 'tcp')}{/if}
				{/each}
			{/if}
		{:else if view === 'docker'}
			<div class="row rhead rdocker" role="row">
				<span class="cell"></span>
				<span class="cell">Port</span>
				<span class="cell">Container</span>
				<span class="cell dcol-internal">Internal</span>
				<span class="cell"></span>
				<span class="cell"></span>
			</div>

			{#if !dockerReady}
				{#each SKELETON_DOCKER_WIDTHS as w (w)}
					<div class="row rdocker sk-row" aria-hidden="true">
						<span class="cell"><span class="dot" style="background: var(--sk-hi)"></span></span>
						<span class="cell"><span class="sk" style="width: 34px"></span></span>
						<span class="cell"><span class="sk" style="width: {w}%"></span></span>
						<span class="cell"><span class="sk" style="width: 64px"></span></span>
						<span class="cell"></span>
						<span class="cell"></span>
					</div>
				{/each}
			{:else if !dockerAvailable}
				<div class="notice">
					<p class="notice-t">Docker unavailable</p>
					<p class="notice-b">{dockerReason ?? 'Could not reach Docker.'}</p>
					<p class="notice-h">Start Docker Desktop and <button class="link" onclick={refresh}>try again</button>.</p>
				</div>
			{:else if visibleDports.length === 0}
				<p class="empty">{filter ? 'No ports match the filter.' : 'No published Docker ports.'}</p>
			{:else}
				{#each visibleDports as d, i (d.containerId + ':' + d.hostPort + ':' + d.protocol)}
					{@const key = keyFor('docker', d)}
					<div
						class="row rdocker"
						class:open={isOpen(key)}
						data-idx={i}
						role="row"
						tabindex="0"
						onclick={(e) => rowClick(e, key, 'docker', d.containerId)}
						onkeydown={(e) => rowKey(e, i, key, 'docker', d.containerId, false)}
					>
						<span class="cell"><span class="dot" data-risk="running"></span></span>
						<span class="cell port">{d.hostPort}</span>
						<span class="cell proc">
							<span class="cmd">{d.container}</span>
							<span class="scope">{d.image}</span>
							<span class="scope dim">{scopeLabel(d.address)}</span>
						</span>
						<span class="cell map">→ {d.containerPort}/{d.protocol}</span>
						{@render actionCell({ kind: 'docker', id: d.containerId, locked: false, copy: d.hostPort })}
						<span class="cell chevcell">{@render chevron()}</span>
					</div>
					{#if isOpen(key)}{@render detailPanel(key, 'docker')}{/if}
				{/each}
			{/if}
		{:else}
			<div class="row rhead rcont" role="row">
				<span class="cell"></span>
				<span class="cell">Container</span>
				<span class="cell ccol-image">Image</span>
				<span class="cell ccol-status">Status</span>
				<span class="cell dcol-internal">Ports</span>
				<span class="cell"></span>
				<span class="cell"></span>
			</div>

			{#if !containersReady}
				{#each SKELETON_DOCKER_WIDTHS as w (w)}
					<div class="row rcont sk-row" aria-hidden="true">
						<span class="cell"><span class="dot" style="background: var(--sk-hi)"></span></span>
						<span class="cell"><span class="sk" style="width: {w}%"></span></span>
						<span class="cell"><span class="sk" style="width: 58px"></span></span>
						<span class="cell"><span class="sk" style="width: 70px"></span></span>
						<span class="cell"><span class="sk" style="width: 44px"></span></span>
						<span class="cell"></span>
						<span class="cell"></span>
					</div>
				{/each}
			{:else if !containerAvail}
				<div class="notice">
					<p class="notice-t">Docker unavailable</p>
					<p class="notice-b">{containerReason ?? 'Could not reach Docker.'}</p>
					<p class="notice-h">Start Docker Desktop and <button class="link" onclick={refresh}>try again</button>.</p>
				</div>
			{:else if visibleContainers.length === 0}
				<p class="empty">{filter ? 'No containers match the filter.' : 'No containers.'}</p>
			{:else}
				{#each visibleContainers as c, i (c.id)}
					{@const key = 'cont:' + c.id}
					{@const dotState = c.running ? (c.health === 'unhealthy' ? 'bad' : c.health === 'starting' ? 'warn' : 'ok') : 'off'}
					{#if i === 0 || c.project !== visibleContainers[i - 1]?.project}
						<div class="grouphead">{c.project ?? 'ungrouped'}</div>
					{/if}
					<div
						class="row rcont"
						class:open={isOpen(key)}
						data-idx={i}
						role="row"
						tabindex="0"
						onclick={(e) => rowClick(e, key, 'containers', c.id)}
						onkeydown={(e) => rowKey(e, i, key, 'containers', c.id, false)}
					>
						<span class="cell"><span class="dot" data-state={dotState}></span></span>
						<span class="cell proc">
							<span class="cmd">{c.name}</span>
							{#if c.service}<span class="scope">{c.service}</span>{/if}
						</span>
						<span class="cell image">{c.image}</span>
						<span class="cell cstatus" class:up={c.running}>{c.status}</span>
						<span class="cell cports">{c.ports}</span>
						{@render containerActions(c)}
						<span class="cell chevcell">{@render chevron()}</span>
					</div>
					{#if isOpen(key)}{@render logsPanel(key)}{/if}
				{/each}
			{/if}
		{/if}
	</main>

	<footer class="statusbar">
		<span class="hints">
			<kbd>↑↓</kbd> move <span class="d">·</span> <kbd>↵</kbd> expand <span class="d">·</span>
			<kbd>x</kbd> kill <span class="d">·</span> <kbd>/</kbd> filter
		</span>
		<span class="src"><code>lsof</code> + <code>docker</code></span>
	</footer>
</div>

<style>
	.app {
		display: flex;
		flex-direction: column;
		min-height: 100vh;
		max-width: 1040px;
		margin: 0 auto;
		border-inline: 1px solid var(--border);
	}

	/* ---- top bar ---- */
	.topbar {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		height: 46px;
		padding: 0 0.85rem;
		border-bottom: 1px solid var(--border);
		position: sticky;
		top: 0;
		background: color-mix(in srgb, var(--bg) 88%, transparent);
		backdrop-filter: blur(8px);
		z-index: 30;
	}
	.brand {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}
	.pulse {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: var(--ok);
		box-shadow: 0 0 0 0 color-mix(in srgb, var(--ok) 70%, transparent);
		animation: pulse 2.4s ease-out infinite;
	}
	@keyframes pulse {
		0% {
			box-shadow: 0 0 0 0 color-mix(in srgb, var(--ok) 55%, transparent);
		}
		70%,
		100% {
			box-shadow: 0 0 0 5px transparent;
		}
	}
	.name {
		font-weight: 600;
		letter-spacing: -0.01em;
	}
	.views {
		display: flex;
		gap: 1px;
		margin-left: 0.35rem;
	}
	.views button {
		border: none;
		background: none;
		color: var(--muted);
		padding: 0.25rem 0.55rem;
		border-radius: 5px;
		font-size: 12.5px;
		font-weight: 500;
		transition: color 0.12s, background 0.12s;
	}
	.views button:hover {
		color: var(--text);
		background: var(--hover);
	}
	.views button.on {
		color: var(--text);
		background: color-mix(in srgb, var(--accent) 15%, transparent);
	}
	.grow {
		flex: 1;
	}
	.stat {
		color: var(--muted);
		font-size: 12.5px;
		white-space: nowrap;
	}
	.stat .n {
		color: var(--text);
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}
	.stat .sep {
		margin: 0 0.3rem;
		color: var(--faint);
	}
	.stat .risky {
		color: var(--warn);
	}
	.clock {
		font-family: var(--mono);
		font-size: 11.5px;
		color: var(--faint);
		font-variant-numeric: tabular-nums;
	}
	.auto {
		display: inline-flex;
		align-items: center;
		gap: 0.32rem;
		color: var(--muted);
		font-size: 12px;
		user-select: none;
		cursor: pointer;
	}
	.auto input {
		accent-color: var(--accent);
		width: 13px;
		height: 13px;
	}
	.tbtn {
		border: 1px solid var(--border-strong);
		background: var(--panel);
		color: var(--text);
		border-radius: 6px;
		padding: 0.28rem 0.6rem;
		font-size: 12px;
		font-weight: 500;
		transition: border-color 0.12s, background 0.12s;
	}
	.tbtn:hover {
		border-color: var(--muted);
		background: var(--hover);
	}

	/* ---- filter bar ---- */
	.filterbar {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		height: 38px;
		padding: 0 0.85rem;
		border-bottom: 1px solid var(--border);
		position: sticky;
		top: 46px;
		background: var(--bg);
		z-index: 25;
	}
	.search {
		color: var(--faint);
		flex: none;
	}
	.filter {
		flex: 1;
		border: none;
		background: none;
		outline: none;
		font-size: 13px;
		color: var(--text);
		padding: 0;
	}
	.filter::placeholder {
		color: var(--faint);
	}
	.slash {
		font-family: var(--mono);
		font-size: 11px;
		color: var(--faint);
		border: 1px solid var(--border-strong);
		border-radius: 4px;
		padding: 0.05rem 0.32rem;
		line-height: 1.4;
	}
	.clear {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 20px;
		height: 20px;
		border: none;
		background: none;
		color: var(--faint);
		border-radius: 4px;
	}
	.clear:hover {
		color: var(--text);
		background: var(--hover);
	}

	.banner {
		margin: 0.7rem 0.85rem 0;
		padding: 0.55rem 0.75rem;
		border: 1px solid color-mix(in srgb, var(--danger) 45%, var(--border));
		border-radius: 6px;
		color: var(--danger);
		font-size: 12.5px;
		background: color-mix(in srgb, var(--danger) 8%, transparent);
	}

	/* ---- list ---- */
	.list {
		flex: 1;
		padding-bottom: 0.5rem;
	}
	.row {
		display: grid;
		align-items: center;
		gap: 0.7rem;
		padding: 0 0.85rem;
		min-height: 40px;
	}
	.rtcp,
	.rhead:not(.rdocker):not(.rcont) {
		grid-template-columns: 14px 54px minmax(0, 1fr) 50px 52px 62px 96px 20px;
	}
	.rdocker {
		grid-template-columns: 14px 54px minmax(0, 1fr) 118px 96px 20px;
	}
	.rcont {
		grid-template-columns: 14px minmax(0, 1.15fr) minmax(0, 0.85fr) 130px 96px 84px 20px;
	}
	.rhead {
		min-height: 32px;
		border-bottom: 1px solid var(--border);
		position: sticky;
		top: 84px;
		background: var(--bg);
		z-index: 20;
		font-size: 10.5px;
		text-transform: uppercase;
		letter-spacing: 0.07em;
		color: var(--faint);
		font-weight: 500;
	}
	.cell {
		min-width: 0;
	}
	.cell.r {
		text-align: right;
	}

	.row:not(.rhead):not(.sk-row) {
		cursor: pointer;
	}
	.row:not(.rhead):not(.sk-row):hover {
		background: var(--hover);
	}
	.row:not(.rhead):focus-visible {
		background: var(--selected);
		box-shadow: inset 2px 0 0 var(--accent);
		outline: none;
	}
	.row.open {
		background: var(--hover);
	}

	.dot {
		display: inline-block;
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--ok);
	}
	.dot[data-risk='caution'] {
		background: var(--warn);
	}
	.dot[data-risk='system'] {
		background: var(--danger);
	}
	.dot[data-risk='running'],
	.dot[data-state='ok'] {
		background: var(--ok);
	}
	.dot[data-state='warn'] {
		background: var(--warn);
	}
	.dot[data-state='bad'] {
		background: var(--danger);
	}
	.dot[data-state='off'] {
		background: var(--faint);
	}

	/* ---- containers ---- */
	.grouphead {
		padding: 0.75rem 0.85rem 0.2rem 2.5rem;
		font-size: 10.5px;
		text-transform: uppercase;
		letter-spacing: 0.07em;
		color: var(--faint);
		font-weight: 600;
	}
	.image,
	.cports {
		font-family: var(--mono);
		font-size: 11.5px;
		color: var(--muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.cports {
		color: var(--faint);
	}
	.cstatus {
		font-size: 11.5px;
		color: var(--faint);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.cstatus.up {
		color: var(--muted);
	}
	.detail.logs {
		padding: 0.4rem 0.85rem 0.85rem 2.5rem;
	}
	.logskel {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}
	.logbox {
		margin: 0;
		font-family: var(--mono);
		font-size: 11px;
		line-height: 1.55;
		color: var(--muted);
		white-space: pre-wrap;
		word-break: break-all;
		max-height: 300px;
		overflow: auto;
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: 6px;
		padding: 0.6rem 0.7rem;
	}

	.port {
		font-family: var(--mono);
		font-size: 13px;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		letter-spacing: -0.02em;
	}
	.proc {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
		min-width: 0;
	}
	.cmd {
		font-weight: 500;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.scope {
		font-family: var(--mono);
		font-size: 11px;
		color: var(--faint);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		flex-shrink: 1;
	}
	.scope.dim {
		opacity: 0.75;
	}
	.tag {
		flex: none;
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		font-weight: 600;
	}
	.t-system {
		color: var(--danger);
	}
	.t-caution {
		color: var(--warn);
	}
	.metric {
		font-family: var(--mono);
		font-size: 11.5px;
		color: var(--muted);
		font-variant-numeric: tabular-nums;
	}
	.pid {
		font-family: var(--mono);
		font-size: 11.5px;
		color: var(--faint);
		font-variant-numeric: tabular-nums;
	}
	.map {
		font-family: var(--mono);
		font-size: 11.5px;
		color: var(--muted);
	}

	.chevcell {
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--faint);
	}
	.chev {
		transition: transform 0.16s ease;
	}
	.row.open .chev {
		transform: rotate(90deg);
	}

	/* ---- actions ---- */
	.actions {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 0.28rem;
	}
	.icon-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 26px;
		height: 26px;
		border: none;
		background: none;
		border-radius: 6px;
		color: var(--muted);
		padding: 0;
		transition: color 0.12s, background 0.12s, opacity 0.12s;
	}
	.icon-btn:hover:not(:disabled) {
		background: var(--hover);
		color: var(--text);
	}
	.icon-btn:disabled {
		opacity: 0.5;
		cursor: default;
	}
	.icon-btn.danger.reveal {
		opacity: 0;
	}
	.row:hover .icon-btn.danger.reveal,
	.row:focus-visible .icon-btn.danger.reveal,
	.row:focus-within .icon-btn.danger.reveal,
	.icon-btn.danger.reveal:focus-visible {
		opacity: 1;
	}
	.icon-btn.danger:hover {
		color: var(--danger);
		background: color-mix(in srgb, var(--danger) 12%, transparent);
	}
	.icon-btn.force:hover:not(:disabled) {
		color: var(--danger);
	}
	.icon-btn.locked {
		color: var(--faint);
		cursor: not-allowed;
	}
	.icon-btn.go {
		color: var(--ok);
	}
	.icon-btn.go:hover:not(:disabled) {
		background: color-mix(in srgb, var(--ok) 14%, transparent);
	}
	.confirm {
		display: inline-flex;
		align-items: center;
		gap: 0.22rem;
	}
	.kill-btn {
		border: none;
		background: var(--danger);
		color: #fff;
		border-radius: 6px;
		padding: 0.24rem 0.55rem;
		font-size: 12px;
		font-weight: 600;
		white-space: nowrap;
		transition: background 0.12s;
	}
	.kill-btn:hover:not(:disabled) {
		background: var(--danger-strong);
	}
	.kill-btn:disabled {
		opacity: 0.65;
		cursor: default;
	}

	/* ---- tooltip ---- */
	[data-tip] {
		position: relative;
	}
	[data-tip]::after {
		content: attr(data-tip);
		position: absolute;
		bottom: calc(100% + 6px);
		right: 0;
		padding: 0.26rem 0.44rem;
		border-radius: 5px;
		background: var(--tooltip-bg);
		color: var(--tooltip-fg);
		font-family: var(--sans);
		font-size: 11px;
		font-weight: 500;
		line-height: 1.2;
		white-space: nowrap;
		letter-spacing: 0;
		text-transform: none;
		opacity: 0;
		transform: translateY(3px);
		pointer-events: none;
		transition: opacity 0.12s ease, transform 0.12s ease;
		z-index: 40;
		box-shadow: 0 6px 18px color-mix(in srgb, #000 24%, transparent);
	}
	[data-tip]:hover::after,
	[data-tip]:focus-visible::after {
		opacity: 1;
		transform: translateY(0);
	}
	.auto[data-tip]::after,
	.tbtn[data-tip]::after {
		right: auto;
	}

	/* ---- detail ---- */
	.detail {
		padding: 0.35rem 0.85rem 0.85rem 3.2rem;
		background: var(--hover);
		animation: fade 0.15s ease;
	}
	@keyframes fade {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}
	.facts {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem 2rem;
	}
	.fact {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
	}
	.facts dt,
	.cmdline dt {
		font-size: 10.5px;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--faint);
		margin: 0;
	}
	.facts dd {
		margin: 0;
		font-family: var(--mono);
		font-size: 12px;
		color: var(--text);
		font-variant-numeric: tabular-nums;
	}
	.cmdline {
		margin-top: 0.65rem;
		display: flex;
		flex-direction: column;
		gap: 0.28rem;
	}
	.cmdline code {
		font-family: var(--mono);
		font-size: 11.5px;
		color: var(--muted);
		word-break: break-all;
		line-height: 1.5;
	}
	.detail-error {
		margin: 0;
		color: var(--danger);
		font-size: 12px;
	}

	/* ---- states ---- */
	.empty {
		padding: 3rem 1rem;
		text-align: center;
		color: var(--muted);
		font-size: 13px;
	}
	.notice {
		margin: 1.5rem 0.85rem;
		padding: 1.3rem;
		border: 1px solid var(--border-strong);
		border-radius: 8px;
		text-align: center;
	}
	.notice-t {
		margin: 0;
		font-weight: 600;
	}
	.notice-b {
		margin: 0.35rem 0 0;
		color: var(--muted);
		font-size: 12.5px;
	}
	.notice-h {
		margin: 0.8rem 0 0;
		color: var(--faint);
		font-size: 12px;
	}
	.link {
		border: none;
		background: none;
		padding: 0;
		color: var(--accent);
		text-decoration: underline;
		text-underline-offset: 2px;
		font: inherit;
	}

	/* ---- skeleton ---- */
	.sk-row {
		pointer-events: none;
	}
	.sk {
		display: inline-block;
		height: 10px;
		border-radius: 3px;
		vertical-align: middle;
		background: linear-gradient(90deg, var(--sk-base) 25%, var(--sk-hi) 37%, var(--sk-base) 63%);
		background-size: 400% 100%;
		animation: shimmer 1.4s ease infinite;
	}
	@keyframes shimmer {
		0% {
			background-position: 100% 50%;
		}
		100% {
			background-position: 0 50%;
		}
	}

	/* ---- status bar ---- */
	.statusbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		height: 34px;
		padding: 0 0.85rem;
		border-top: 1px solid var(--border);
		position: sticky;
		bottom: 0;
		background: var(--bg);
		font-size: 11.5px;
		color: var(--faint);
	}
	.hints {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		flex-wrap: wrap;
	}
	.hints .d {
		opacity: 0.5;
	}
	.statusbar kbd {
		font-family: var(--mono);
		font-size: 10.5px;
		color: var(--muted);
		border: 1px solid var(--border-strong);
		border-radius: 4px;
		padding: 0.02rem 0.28rem;
		line-height: 1.5;
	}
	.src code {
		font-family: var(--mono);
	}

	@media (prefers-reduced-motion: reduce) {
		.sk,
		.chev,
		.detail,
		.pulse,
		[data-tip]::after {
			animation: none;
			transition: none;
		}
	}

	@media (max-width: 680px) {
		.app {
			border-inline: none;
		}
		.rtcp,
		.rhead:not(.rdocker):not(.rcont) {
			grid-template-columns: 14px 48px minmax(0, 1fr) 92px 20px;
		}
		.rdocker {
			grid-template-columns: 14px 48px minmax(0, 1fr) 92px 20px;
		}
		.rcont {
			grid-template-columns: 14px minmax(0, 1fr) 84px 20px;
		}
		/* drop the secondary columns on small screens */
		.cell.r,
		.map,
		.dcol-internal,
		.image,
		.cstatus,
		.cports,
		.ccol-image,
		.ccol-status {
			display: none;
		}
		.clock,
		.stat {
			display: none;
		}
	}
</style>
