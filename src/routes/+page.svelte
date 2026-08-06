<script lang="ts">
	import { onMount } from 'svelte';
	import { FilterBar, Icon, StatusBar, TopBar } from '$lib/components';
	import { app } from '$lib/stores';
	import type { ContainerInfo, View } from '$lib/types';
	import { SKELETON_DOCKER_WIDTHS, SKELETON_TCP_WIDTHS } from '$lib/constants';
	import { formatMem, scopeLabel } from '$lib/utils';

	onMount(app.refresh);

	$effect(() => {
		if (!app.autoRefresh) return;
		const id = setInterval(app.refresh, app.refreshMs);
		return () => clearInterval(id);
	});
</script>

<svelte:window onkeydown={app.onGlobalKey} />

<svelte:head>
	<title>portpilot — ports & docker</title>
</svelte:head>

{#snippet actionCell(a: { kind: View; id: number | string; locked: boolean; copy?: number })}
	{@const active = a.kind === 'tcp' ? app.confirming === a.id : app.dconfirming === a.id}
	{@const busy = a.kind === 'tcp' ? app.killing === a.id : app.busyId === a.id}
	<span class="cell actions">
		{#if a.locked}
			<span class="icon-btn locked" role="img" aria-label="Protected system process" data-tip="Protected — can’t kill">
				<Icon name="lock" />
			</span>
		{:else if active}
			<span class="confirm">
				<button class="kill-btn" onclick={() => app.confirmAction(a.kind, a.id)} disabled={busy}>
					{busy ? '…' : a.kind === 'tcp' ? 'Kill' : 'Stop'}
				</button>
				{#if a.kind === 'tcp'}
					<button class="icon-btn force" onclick={() => app.kill(a.id as number, true)} disabled={busy} data-tip="Force · SIGKILL" aria-label="Force kill">
						<Icon name="zap" />
					</button>
				{/if}
				<button class="icon-btn" onclick={() => app.cancelAction(a.kind)} disabled={busy} data-tip="Cancel" aria-label="Cancel">
					<Icon name="x" />
				</button>
			</span>
		{:else}
			{#if a.copy != null}
				<button class="icon-btn reveal" onclick={() => app.copyText('localhost:' + a.copy)} data-tip={'Copy localhost:' + a.copy} aria-label="Copy address">
					<Icon name="copy" />
				</button>
			{/if}
			{#if a.kind === 'docker'}
				<button class="icon-btn reveal" onclick={() => app.containerDo(a.id as string, 'restart')} disabled={busy} data-tip="Restart container" aria-label="Restart container">
					<Icon name="restart" />
				</button>
			{/if}
			<button class="icon-btn danger reveal" onclick={() => app.beginAction(a.kind, a.id)} data-tip={a.kind === 'tcp' ? 'Kill port' : 'Stop container'} aria-label={a.kind === 'tcp' ? 'Kill port' : 'Stop container'}>
				{#if a.kind === 'tcp'}<Icon name="power" />{:else}<Icon name="stop" />{/if}
			</button>
		{/if}
	</span>
{/snippet}

{#snippet detailPanel(key: string, kind: View)}
	{@const d = app.details[key]}
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
	{@const busy = app.busyId === c.id}
	<span class="cell actions">
		{#if app.dconfirming === c.id}
			<span class="confirm">
				<button class="kill-btn" onclick={() => app.containerDo(c.id, 'stop')} disabled={busy}>
					{busy ? '…' : 'Stop'}
				</button>
				<button class="icon-btn" onclick={() => (app.dconfirming = null)} disabled={busy} data-tip="Cancel" aria-label="Cancel">
					<Icon name="x" />
				</button>
			</span>
		{:else if c.running}
			<button class="icon-btn reveal" onclick={() => app.containerDo(c.id, 'restart')} disabled={busy} data-tip="Restart" aria-label="Restart">
				<Icon name="restart" />
			</button>
			<button class="icon-btn danger reveal" onclick={() => (app.dconfirming = c.id)} disabled={busy} data-tip="Stop" aria-label="Stop">
				<Icon name="stop" />
			</button>
		{:else}
			<button class="icon-btn go" onclick={() => app.containerDo(c.id, 'start')} disabled={busy} data-tip="Start" aria-label="Start">
				<Icon name="play" />
			</button>
		{/if}
	</span>
{/snippet}

{#snippet logsPanel(key: string)}
	{@const d = app.details[key]}
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
	<TopBar />

	<FilterBar />

	{#if app.error}
		<div class="banner" role="alert">{app.error}</div>
	{/if}

	<main class="list">
		{#if app.view === 'tcp'}
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

			{#if !app.portsReady}
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
			{:else if app.visiblePorts.length === 0}
				<p class="empty">{app.filter ? 'No ports match the filter.' : 'No listening TCP ports. All quiet.'}</p>
			{:else}
				{#each app.visiblePorts as p, i (p.pid + ':' + p.port)}
					{@const key = app.keyFor('tcp', p)}
					<div
						class="row rtcp"
						class:open={app.isOpen(key)}
						data-risk={p.risk}
						data-idx={i}
						role="row"
						tabindex="0"
						onclick={(e) => app.rowClick(e, key, 'tcp', p.pid)}
						onkeydown={(e) => app.rowKey(e, i, key, 'tcp', p.pid, p.risk === 'system')}
					>
						<span class="cell"><span class="dot" data-risk={p.risk} title={p.riskNote}></span></span>
						<span class="cell port">{p.port}</span>
						<span class="cell proc">
							<span class="cmd" title={p.fullCommand}>{p.command || '—'}</span>
							<span class="scope">{scopeLabel(p.address)}</span>
							{#if p.risk !== 'safe'}<span class="tag t-{p.risk}">{p.risk}</span>{/if}
						</span>
						<span class="cell r metric">{p.cpu != null ? p.cpu + '%' : '·'}</span>
						<span class="cell r metric">{p.rssMb != null ? formatMem(p.rssMb) : '·'}</span>
						<span class="cell r pid">{p.pid}</span>
						{@render actionCell({ kind: 'tcp', id: p.pid, locked: p.risk === 'system' })}
						<span class="cell chevcell"><Icon name="chevron" open={app.isOpen(key)} /></span>
					</div>
					{#if app.isOpen(key)}{@render detailPanel(key, 'tcp')}{/if}
				{/each}
			{/if}
		{:else if app.view === 'docker'}
			<div class="row rhead rdocker" role="row">
				<span class="cell"></span>
				<span class="cell">Port</span>
				<span class="cell">Container</span>
				<span class="cell dcol-internal">Internal</span>
				<span class="cell"></span>
				<span class="cell"></span>
			</div>

			{#if !app.dockerReady}
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
			{:else if !app.dockerAvailable}
				<div class="notice">
					<p class="notice-t">Docker unavailable</p>
					<p class="notice-b">{app.dockerReason ?? 'Could not reach Docker.'}</p>
					<p class="notice-h">Start Docker Desktop and <button class="link" onclick={app.refresh}>try again</button>.</p>
				</div>
			{:else if app.visibleDports.length === 0}
				<p class="empty">{app.filter ? 'No ports match the filter.' : 'No published Docker ports.'}</p>
			{:else}
				{#each app.visibleDports as d, i (d.containerId + ':' + d.hostPort + ':' + d.protocol)}
					{@const key = app.keyFor('docker', d)}
					<div
						class="row rdocker"
						class:open={app.isOpen(key)}
						data-idx={i}
						role="row"
						tabindex="0"
						onclick={(e) => app.rowClick(e, key, 'docker', d.containerId)}
						onkeydown={(e) => app.rowKey(e, i, key, 'docker', d.containerId, false)}
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
						<span class="cell chevcell"><Icon name="chevron" open={app.isOpen(key)} /></span>
					</div>
					{#if app.isOpen(key)}{@render detailPanel(key, 'docker')}{/if}
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

			{#if !app.containersReady}
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
			{:else if !app.containerAvail}
				<div class="notice">
					<p class="notice-t">Docker unavailable</p>
					<p class="notice-b">{app.containerReason ?? 'Could not reach Docker.'}</p>
					<p class="notice-h">Start Docker Desktop and <button class="link" onclick={app.refresh}>try again</button>.</p>
				</div>
			{:else if app.visibleContainers.length === 0}
				<p class="empty">{app.filter ? 'No containers match the filter.' : 'No containers.'}</p>
			{:else}
				{#each app.visibleContainers as c, i (c.id)}
					{@const key = 'cont:' + c.id}
					{@const dotState = c.running ? (c.health === 'unhealthy' ? 'bad' : c.health === 'starting' ? 'warn' : 'ok') : 'off'}
					{#if i === 0 || c.project !== app.visibleContainers[i - 1]?.project}
						<div class="grouphead">{c.project ?? 'ungrouped'}</div>
					{/if}
					<div
						class="row rcont"
						class:open={app.isOpen(key)}
						data-idx={i}
						role="row"
						tabindex="0"
						onclick={(e) => app.rowClick(e, key, 'containers', c.id)}
						onkeydown={(e) => app.rowKey(e, i, key, 'containers', c.id, false)}
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
						<span class="cell chevcell"><Icon name="chevron" open={app.isOpen(key)} /></span>
					</div>
					{#if app.isOpen(key)}{@render logsPanel(key)}{/if}
				{/each}
			{/if}
		{/if}
	</main>

	<StatusBar />
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

	@media (prefers-reduced-motion: reduce) {
		.sk,
		.detail {
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
	}
</style>
