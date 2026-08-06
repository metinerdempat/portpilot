<script lang="ts">
	import { onMount } from 'svelte';
	import type { DockerPort, PortEntry, View } from '$lib/types';
	import { REFRESH_MS, SKELETON_DOCKER_WIDTHS, SKELETON_TCP_WIDTHS } from '$lib/constants';
	import { formatNow, readErrorMessage, scopeLabel } from '$lib/utils';

	type Detail = {
		loading: boolean;
		error: string | null;
		data: Record<string, string | number | null> | null;
	};

	let view = $state<View>('tcp');

	// ---- tcp ports ----
	let ports = $state<PortEntry[]>([]);
	let portsReady = $state(false);
	let confirming = $state<number | null>(null); // pid awaiting confirmation
	let killing = $state<number | null>(null); // pid currently being killed
	let riskyCount = $derived(ports.filter((p) => p.risk !== 'safe').length);

	// ---- docker ports ----
	let dports = $state<DockerPort[]>([]);
	let dockerReady = $state(false);
	let dockerAvailable = $state(true);
	let dockerReason = $state<string | null>(null);
	let dconfirming = $state<string | null>(null); // container id awaiting confirmation
	let stopping = $state<string | null>(null); // container id currently stopping

	// ---- expand / detail ----
	let expanded = $state<string[]>([]);
	let details = $state<Record<string, Detail>>({});

	// ---- shared ----
	let error = $state<string | null>(null);
	let autoRefresh = $state(false);
	let updatedAt = $state('');

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

	function refresh() {
		return view === 'tcp' ? loadPorts() : loadDocker();
	}

	function switchView(v: View) {
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

	async function stopContainer(id: string) {
		stopping = id;
		try {
			const res = await fetch('/api/docker', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ id })
			});
			if (!res.ok) throw new Error(await readErrorMessage(res));
			dconfirming = null;
			await loadDocker();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to stop the container.';
		} finally {
			stopping = null;
		}
	}

	// ---- action helpers, shared by both views ----
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
		else stopContainer(id as string);
	}

	// ---- expand / detail ----
	function isOpen(key: string) {
		return expanded.includes(key);
	}

	async function loadDetail(key: string, kind: View, id: number | string) {
		details = { ...details, [key]: { loading: true, error: null, data: null } };
		try {
			const url =
				kind === 'tcp'
					? `/api/process?pid=${id}`
					: `/api/docker/stats?id=${encodeURIComponent(String(id))}`;
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

	function toggleExpand(key: string, kind: View, id: number | string) {
		if (isOpen(key)) {
			expanded = expanded.filter((k) => k !== key);
		} else {
			expanded = [...expanded, key];
			loadDetail(key, kind, id); // fresh snapshot each time it opens
		}
	}

	// Row click is a mouse convenience; clicks on inner buttons are theirs.
	function onRowClick(e: MouseEvent, key: string, kind: View, id: number | string) {
		if ((e.target as HTMLElement).closest('button')) return;
		toggleExpand(key, kind, id);
	}

	function onRowKey(e: KeyboardEvent, key: string, kind: View, id: number | string) {
		if (e.target !== e.currentTarget) return; // ignore keys bubbling up from action buttons
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			toggleExpand(key, kind, id);
		}
	}

	onMount(refresh);

	// Poll the active view while auto-refresh is on.
	$effect(() => {
		if (!autoRefresh) return;
		const id = setInterval(refresh, REFRESH_MS);
		return () => clearInterval(id);
	});
</script>

{#snippet chevron()}
	<svg class="ic-chev" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
		<path d="M9 5l7 7-7 7" />
	</svg>
{/snippet}

{#snippet powerIcon()}
	<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
		<path d="M12 4v8" />
		<path d="M7.6 7.2a7 7 0 1 0 8.8 0" />
	</svg>
{/snippet}

{#snippet stopIcon()}
	<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true">
		<rect x="6" y="6" width="12" height="12" rx="2.5" />
	</svg>
{/snippet}

{#snippet xIcon()}
	<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
		<path d="M6 6l12 12M18 6L6 18" />
	</svg>
{/snippet}

{#snippet lockIcon()}
	<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
		<rect x="5" y="11" width="14" height="9" rx="2" />
		<path d="M8 11V8a4 4 0 0 1 8 0v3" />
	</svg>
{/snippet}

{#snippet actionCell(a: { kind: View; id: number | string; locked: boolean })}
	{@const active = a.kind === 'tcp' ? confirming === a.id : dconfirming === a.id}
	{@const busy = a.kind === 'tcp' ? killing === a.id : stopping === a.id}
	<span class="action" role="cell">
		{#if a.locked}
			<span
				class="act act-locked"
				role="img"
				aria-label="Protected system process"
				data-tooltip="Protected system process — can’t be killed here"
			>
				{@render lockIcon()}
			</span>
		{:else if active}
			<span class="confirm">
				<button class="act-yes" onclick={() => confirmAction(a.kind, a.id)} disabled={busy}>
					{busy ? '…' : a.kind === 'tcp' ? 'Kill' : 'Stop'}
				</button>
				{#if a.kind === 'tcp'}
					<button
						class="act-force"
						onclick={() => kill(a.id as number, true)}
						disabled={busy}
						data-tooltip="Force kill — SIGKILL">force</button
					>
				{/if}
				<button
					class="act-cancel"
					onclick={() => cancelAction(a.kind)}
					disabled={busy}
					aria-label="Cancel"
					data-tooltip="Cancel"
				>
					{@render xIcon()}
				</button>
			</span>
		{:else}
			<button
				class="act act-danger"
				onclick={() => beginAction(a.kind, a.id)}
				aria-label={a.kind === 'tcp' ? 'Kill port' : 'Stop container'}
				data-tooltip={a.kind === 'tcp' ? 'Kill port' : 'Stop container'}
			>
				{#if a.kind === 'tcp'}{@render powerIcon()}{:else}{@render stopIcon()}{/if}
			</button>
		{/if}
	</span>
{/snippet}

{#snippet detail(key: string, kind: View)}
	{@const d = details[key]}
	<div class="detail">
		{#if !d || d.loading}
			<dl class="facts">
				{#each [64, 88, 72, 96] as w (w)}
					<div>
						<dt><span class="sk" style="width: 42px; height: 8px"></span></dt>
						<dd><span class="sk" style="width: {w}px; height: 9px"></span></dd>
					</div>
				{/each}
			</dl>
		{:else if d.error}
			<p class="detail-error">{d.error}</p>
		{:else if kind === 'tcp' && d.data}
			{@const x = d.data}
			<dl class="facts">
				<div><dt>CPU</dt><dd>{x.cpu}%</dd></div>
				<div><dt>Memory</dt><dd>{x.rssMb} MB · {x.mem}%</dd></div>
				<div><dt>Uptime</dt><dd>{x.uptime}</dd></div>
				<div><dt>Parent</dt><dd>PID {x.ppid}</dd></div>
			</dl>
			<div class="cmdline">
				<span>Full command</span>
				<code>{x.command}</code>
			</div>
		{:else if d.data}
			{@const x = d.data}
			<dl class="facts">
				<div><dt>CPU</dt><dd>{x.cpu}</dd></div>
				<div><dt>Memory</dt><dd>{x.mem} · {x.memPerc}</dd></div>
				<div><dt>Network I/O</dt><dd>{x.net}</dd></div>
				<div><dt>Disk I/O</dt><dd>{x.block}</dd></div>
				<div><dt>Processes</dt><dd>{x.pids}</dd></div>
			</dl>
		{/if}
	</div>
{/snippet}

<svelte:head>
	<title>portpilot — ports & docker</title>
</svelte:head>

<main>
	<header>
		<div class="wordmark">
			<span class="dot" aria-hidden="true"></span>
			<h1>portpilot</h1>
		</div>
		<p class="sub">
			The TCP ports your machine is listening on, plus the ports your Docker containers publish — all
			in one place.
		</p>

		<div class="tabs" role="tablist" aria-label="View">
			<button
				role="tab"
				aria-selected={view === 'tcp'}
				class:active={view === 'tcp'}
				onclick={() => switchView('tcp')}
			>
				TCP Ports
			</button>
			<button
				role="tab"
				aria-selected={view === 'docker'}
				class:active={view === 'docker'}
				onclick={() => switchView('docker')}
			>
				Docker Ports
			</button>
		</div>

		<div class="toolbar">
			<div class="count">
				{#if view === 'tcp' && portsReady}
					<strong>{ports.length}</strong> active ports
					{#if riskyCount > 0}<span class="risky-note"> · {riskyCount} risky</span>{/if}
				{:else if view === 'docker' && dockerReady && dockerAvailable}
					<strong>{dports.length}</strong> published
				{/if}
				{#if updatedAt}<span class="stamp">· {updatedAt}</span>{/if}
			</div>
			<div class="controls">
				<label class="toggle">
					<input type="checkbox" bind:checked={autoRefresh} />
					Auto-refresh
				</label>
				<button class="refresh" onclick={refresh}>Refresh</button>
			</div>
		</div>
	</header>

	{#if error}
		<div class="banner" role="alert">{error}</div>
	{/if}

	{#if view === 'tcp'}
		{#if !portsReady}
			<div class="table" aria-busy="true" aria-label="Loading ports">
				<div class="row row-tcp head" role="row">
					<span></span>
					<span>Port</span>
					<span>Process</span>
					<span class="num pid">PID</span>
					<span class="col-user">User</span>
					<span></span>
				</div>
				{#each SKELETON_TCP_WIDTHS as w (w)}
					<div class="row row-tcp sk-row" aria-hidden="true">
						<span></span>
						<span><span class="sk sk-lg" style="width: 40px"></span></span>
						<span><span class="sk" style="width: {w}%"></span></span>
						<span class="num pid"><span class="sk" style="width: 42px"></span></span>
						<span class="col-user"><span class="sk" style="width: 74px"></span></span>
						<span class="action"><span class="sk sk-act"></span></span>
					</div>
				{/each}
			</div>
		{:else if ports.length === 0}
			<p class="state">No listening TCP ports. All quiet.</p>
		{:else}
			<div class="table" role="table" aria-label="Active TCP ports">
				<div class="row row-tcp head" role="row">
					<span></span>
					<span>Port</span>
					<span>Process</span>
					<span class="num pid">PID</span>
					<span class="col-user">User</span>
					<span></span>
				</div>

				{#each ports as p (p.pid + ':' + p.port)}
					{@const key = 'tcp:' + p.pid + ':' + p.port}
					<div
						class="row row-tcp"
						class:open={isOpen(key)}
						data-risk={p.risk}
						role="row"
						tabindex="0"
						aria-expanded={isOpen(key)}
						onclick={(e) => onRowClick(e, key, 'tcp', p.pid)}
						onkeydown={(e) => onRowKey(e, key, 'tcp', p.pid)}
					>
						<span class="chev-cell" role="cell" aria-hidden="true">
							{@render chevron()}
						</span>

						<span class="port" role="cell">{p.port}</span>

						<span class="proc" role="cell">
							<span class="cmd">{p.command || '—'}</span>
							<span class="addr">{scopeLabel(p.address)}</span>
							{#if p.risk !== 'safe'}
								<span class="risk-tag risk-{p.risk}" title={p.riskNote}>
									{p.risk === 'system' ? 'system' : 'caution'}
								</span>
							{/if}
						</span>

						<span class="num pid" role="cell">{p.pid}</span>
						<span class="col-user user" role="cell">{p.user}</span>

						{@render actionCell({ kind: 'tcp', id: p.pid, locked: p.risk === 'system' })}
					</div>
					{#if isOpen(key)}
						{@render detail(key, 'tcp')}
					{/if}
				{/each}
			</div>
		{/if}
	{:else if !dockerReady}
		<div class="table" aria-busy="true" aria-label="Loading Docker ports">
			<div class="row row-docker head" role="row">
				<span></span>
				<span>Port</span>
				<span>Container</span>
				<span class="num inner">Internal</span>
				<span></span>
			</div>
			{#each SKELETON_DOCKER_WIDTHS as w (w)}
				<div class="row row-docker sk-row" aria-hidden="true">
					<span></span>
					<span><span class="sk sk-lg" style="width: 40px"></span></span>
					<span><span class="sk" style="width: {w}%"></span></span>
					<span class="num inner"><span class="sk" style="width: 60px"></span></span>
					<span class="action"><span class="sk sk-act"></span></span>
				</div>
			{/each}
		</div>
	{:else if !dockerAvailable}
		<div class="notice">
			<p class="notice-title">Docker unavailable</p>
			<p class="notice-body">{dockerReason ?? 'Could not reach Docker.'}</p>
			<p class="notice-hint">
				Start Docker Desktop and <button class="link" onclick={refresh}>try again</button>.
			</p>
		</div>
	{:else if dports.length === 0}
		<p class="state">No published Docker ports. No running containers, or none publish a port.</p>
	{:else}
		<div class="table" role="table" aria-label="Docker ports">
			<div class="row row-docker head" role="row">
				<span></span>
				<span>Port</span>
				<span>Container</span>
				<span class="num inner">Internal</span>
				<span></span>
			</div>

			{#each dports as d (d.containerId + ':' + d.hostPort + ':' + d.protocol)}
				{@const key = 'docker:' + d.containerId + ':' + d.hostPort + ':' + d.protocol}
				<div
					class="row row-docker"
					class:open={isOpen(key)}
					role="row"
					tabindex="0"
					aria-expanded={isOpen(key)}
					onclick={(e) => onRowClick(e, key, 'docker', d.containerId)}
					onkeydown={(e) => onRowKey(e, key, 'docker', d.containerId)}
				>
					<span class="chev-cell" role="cell" aria-hidden="true">
						{@render chevron()}
					</span>

					<span class="port" role="cell">{d.hostPort}</span>

					<span class="proc" role="cell">
						<span class="cmd">{d.container}</span>
						<span class="hint">{d.image}</span>
						<span class="addr">{scopeLabel(d.address)}</span>
					</span>

					<span class="num inner" role="cell">→ {d.containerPort}/{d.protocol}</span>

					{@render actionCell({ kind: 'docker', id: d.containerId, locked: false })}
				</div>
				{#if isOpen(key)}
					{@render detail(key, 'docker')}
				{/if}
			{/each}
		</div>
	{/if}

	<footer>
		<span>Runs locally · <code>lsof</code> + <code>docker</code></span>
		{#if view === 'tcp'}
			<span>Click a row → resources &amp; details · <code>⏻</code> = kill</span>
		{:else}
			<span>Click a row → stats · <code>◼</code> = stop container</span>
		{/if}
	</footer>
</main>

<style>
	main {
		max-width: 820px;
		margin: 0 auto;
		padding: clamp(2rem, 6vw, 5rem) 1.25rem 4rem;
	}

	/* ---- header ---- */
	.wordmark {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}
	.dot {
		width: 9px;
		height: 9px;
		border-radius: 50%;
		background: #2fbf71;
		box-shadow: 0 0 0 3px color-mix(in srgb, #2fbf71 22%, transparent);
	}
	h1 {
		margin: 0;
		font-size: 1.6rem;
		font-weight: 640;
		letter-spacing: -0.02em;
	}
	.sub {
		margin: 0.7rem 0 0;
		color: var(--muted);
		max-width: 54ch;
	}

	.tabs {
		display: inline-flex;
		gap: 2px;
		margin-top: 1.5rem;
		padding: 3px;
		border: 1px solid var(--line);
		border-radius: 9px;
		background: var(--surface);
	}
	.tabs button {
		border: none;
		background: none;
		padding: 0.38rem 0.95rem;
		border-radius: 6px;
		color: var(--muted);
		font-size: 0.9rem;
		transition: background 0.15s, color 0.15s;
	}
	.tabs button:hover {
		color: var(--text);
	}
	.tabs button.active {
		background: color-mix(in srgb, var(--text) 8%, transparent);
		color: var(--text);
		font-weight: 540;
	}

	.toolbar {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 1rem;
		margin-top: 1.25rem;
		padding-bottom: 0.85rem;
		border-bottom: 1px solid var(--line-strong);
		flex-wrap: wrap;
	}
	.count {
		color: var(--muted);
		font-size: 0.9rem;
	}
	.count strong {
		color: var(--text);
		font-variant-numeric: tabular-nums;
	}
	.stamp {
		font-family: var(--mono);
		font-size: 0.8rem;
		color: var(--faint);
	}
	.risky-note {
		color: var(--warn);
	}
	.controls {
		display: flex;
		align-items: center;
		gap: 1rem;
	}
	.toggle {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		font-size: 0.9rem;
		color: var(--muted);
		user-select: none;
	}
	.toggle input {
		accent-color: var(--text);
	}
	.refresh {
		background: var(--surface);
		color: var(--text);
		border: 1px solid var(--line-strong);
		border-radius: 6px;
		padding: 0.4rem 0.85rem;
		font-size: 0.875rem;
		transition: border-color 0.15s;
	}
	.refresh:hover {
		border-color: var(--text);
	}

	/* ---- table ---- */
	.table {
		margin-top: 0.25rem;
	}
	.row {
		display: grid;
		align-items: center;
		gap: 1rem;
		padding: 0.8rem 0.25rem;
		border-bottom: 1px solid var(--line);
	}
	.row-tcp {
		grid-template-columns: 24px 62px minmax(0, 1fr) 66px 88px 150px;
	}
	.row-docker {
		grid-template-columns: 24px 62px minmax(0, 1fr) 116px 128px;
	}
	.row.head {
		padding-top: 0.75rem;
		padding-bottom: 0.75rem;
		border-bottom: 1px solid var(--line-strong);
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.09em;
		color: var(--faint);
	}
	.row:not(.head):not(.sk-row) {
		cursor: pointer;
	}
	.row:not(.head):not(.sk-row):hover {
		background: color-mix(in srgb, var(--text) 3.5%, transparent);
	}
	.row.open {
		border-bottom-color: transparent;
		background: color-mix(in srgb, var(--text) 3.5%, transparent);
	}
	.row:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: -2px;
		border-radius: 4px;
	}

	/* bigger risk accent bar */
	.row[data-risk='system'] {
		box-shadow: inset 4px 0 0 var(--danger);
	}
	.row[data-risk='caution'] {
		box-shadow: inset 4px 0 0 var(--warn);
	}

	/* chevron */
	.chev-cell {
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--faint);
		transition: color 0.15s;
	}
	.row:hover .chev-cell,
	.row:focus-visible .chev-cell {
		color: var(--muted);
	}
	.ic-chev {
		transition: transform 0.18s ease;
	}
	.row.open .ic-chev {
		transform: rotate(90deg);
	}

	.port {
		font-family: var(--mono);
		font-size: 1.05rem;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}
	.num {
		font-family: var(--mono);
		font-variant-numeric: tabular-nums;
		text-align: right;
	}
	.pid {
		color: var(--muted);
		font-size: 0.9rem;
	}
	.inner {
		color: var(--muted);
		font-size: 0.85rem;
	}

	.proc {
		display: flex;
		align-items: baseline;
		gap: 0.55rem;
		min-width: 0;
		flex-wrap: wrap;
	}
	.cmd {
		font-weight: 520;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 100%;
	}
	.hint {
		font-size: 0.78rem;
		color: var(--muted);
	}
	.addr {
		font-size: 0.76rem;
		color: var(--faint);
		font-family: var(--mono);
	}
	.user {
		color: var(--muted);
		font-size: 0.875rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	/* risk markers */
	.risk-tag {
		font-size: 0.68rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		font-weight: 600;
		cursor: help;
	}
	.risk-system {
		color: var(--danger);
	}
	.risk-caution {
		color: var(--warn);
	}

	/* ---- actions ---- */
	.action {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 0.4rem;
	}
	.act {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		border: none;
		background: none;
		border-radius: 8px;
		color: var(--faint);
		padding: 0;
		transition: color 0.15s, background 0.15s;
	}
	.row:hover .act {
		color: var(--muted);
	}
	.act-danger:hover {
		color: var(--danger);
		background: color-mix(in srgb, var(--danger) 11%, transparent);
	}
	.act-locked {
		cursor: not-allowed;
	}
	.confirm {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		flex-wrap: nowrap;
	}
	.act-yes {
		border: none;
		background: var(--danger);
		color: #fff;
		border-radius: 6px;
		padding: 0.34rem 0.72rem;
		font-size: 0.82rem;
		font-weight: 500;
		white-space: nowrap;
		transition: background 0.15s, opacity 0.15s;
	}
	.act-yes:hover:not(:disabled) {
		background: var(--danger-strong);
	}
	.act-yes:disabled {
		opacity: 0.6;
		cursor: default;
	}
	.act-force {
		border: none;
		background: none;
		color: var(--faint);
		font-size: 0.75rem;
		padding: 2px 3px;
		white-space: nowrap;
		transition: color 0.15s;
	}
	.act-force:hover:not(:disabled) {
		color: var(--danger);
	}
	.act-force:disabled {
		opacity: 0.5;
		cursor: default;
	}
	.act-cancel {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border: none;
		background: none;
		border-radius: 6px;
		color: var(--muted);
		padding: 0;
		transition: color 0.15s, background 0.15s;
	}
	.act-cancel:hover:not(:disabled) {
		color: var(--text);
		background: color-mix(in srgb, var(--text) 8%, transparent);
	}

	/* ---- tooltip ---- */
	[data-tooltip] {
		position: relative;
	}
	[data-tooltip]::after {
		content: attr(data-tooltip);
		position: absolute;
		bottom: calc(100% + 7px);
		right: 0;
		padding: 0.3rem 0.5rem;
		border-radius: 5px;
		background: var(--tooltip-bg);
		color: var(--tooltip-fg);
		font-size: 0.72rem;
		font-weight: 500;
		line-height: 1.2;
		white-space: nowrap;
		letter-spacing: 0;
		text-transform: none;
		opacity: 0;
		transform: translateY(3px);
		pointer-events: none;
		transition: opacity 0.13s ease, transform 0.13s ease;
		z-index: 20;
		box-shadow: 0 4px 14px color-mix(in srgb, #000 20%, transparent);
	}
	[data-tooltip]:hover::after,
	[data-tooltip]:focus-visible::after {
		opacity: 1;
		transform: translateY(0);
	}

	/* ---- detail panel ---- */
	.detail {
		padding: 0.4rem 0.5rem 1.1rem 2.35rem;
		border-bottom: 1px solid var(--line);
		background: color-mix(in srgb, var(--text) 3.5%, transparent);
		animation: detail-in 0.16s ease;
	}
	@keyframes detail-in {
		from {
			opacity: 0;
			transform: translateY(-3px);
		}
		to {
			opacity: 1;
			transform: none;
		}
	}
	.facts {
		margin: 0;
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
		gap: 0.7rem 1.5rem;
	}
	.facts div {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		min-width: 0;
	}
	.facts dt {
		font-size: 0.68rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--faint);
	}
	.facts dd {
		margin: 0;
		font-family: var(--mono);
		font-size: 0.85rem;
		color: var(--text);
	}
	.cmdline {
		margin-top: 0.9rem;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	.cmdline span {
		font-size: 0.68rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--faint);
	}
	.cmdline code {
		font-family: var(--mono);
		font-size: 0.8rem;
		color: var(--muted);
		word-break: break-all;
		line-height: 1.55;
	}
	.detail-error {
		margin: 0;
		color: var(--danger);
		font-size: 0.85rem;
	}

	/* ---- skeleton ---- */
	.sk-row {
		pointer-events: none;
	}
	.sk {
		display: inline-block;
		height: 11px;
		border-radius: 4px;
		vertical-align: middle;
		background: linear-gradient(90deg, var(--sk-base) 25%, var(--sk-hi) 37%, var(--sk-base) 63%);
		background-size: 400% 100%;
		animation: sk-shimmer 1.4s ease infinite;
	}
	.sk-lg {
		height: 15px;
	}
	.sk-act {
		width: 32px;
		height: 32px;
		border-radius: 8px;
	}
	@keyframes sk-shimmer {
		0% {
			background-position: 100% 50%;
		}
		100% {
			background-position: 0 50%;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.sk,
		.detail,
		.ic-chev,
		[data-tooltip]::after {
			animation: none;
			transition: none;
		}
	}

	/* ---- misc ---- */
	.banner {
		margin: 1.25rem 0 0;
		padding: 0.7rem 0.9rem;
		border: 1px solid color-mix(in srgb, var(--danger) 45%, var(--line));
		border-radius: 6px;
		color: var(--danger);
		font-size: 0.9rem;
		background: color-mix(in srgb, var(--danger) 7%, transparent);
	}
	.state {
		margin: 3rem 0;
		text-align: center;
		color: var(--muted);
	}
	.notice {
		margin: 2rem 0;
		padding: 1.4rem 1.5rem;
		border: 1px solid var(--line-strong);
		border-radius: 10px;
		background: var(--surface);
		text-align: center;
	}
	.notice-title {
		margin: 0;
		font-weight: 600;
	}
	.notice-body {
		margin: 0.4rem 0 0;
		color: var(--muted);
		font-size: 0.9rem;
	}
	.notice-hint {
		margin: 0.9rem 0 0;
		font-size: 0.85rem;
		color: var(--faint);
	}
	.link {
		background: none;
		border: none;
		padding: 0;
		color: var(--text);
		text-decoration: underline;
		text-underline-offset: 2px;
		font: inherit;
		cursor: pointer;
	}
	footer {
		margin-top: 2.5rem;
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
		font-size: 0.78rem;
		color: var(--faint);
	}
	footer code {
		font-family: var(--mono);
	}

	@media (max-width: 620px) {
		.row-tcp {
			grid-template-columns: 24px 54px minmax(0, 1fr) 132px;
		}
		.row-docker {
			grid-template-columns: 24px 54px minmax(0, 1fr) 120px;
		}
		.col-user,
		.pid,
		.inner {
			display: none;
		}
		.detail {
			padding-left: 1rem;
		}
	}
</style>
