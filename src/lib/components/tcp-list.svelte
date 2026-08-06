<script lang="ts">
	import { app } from '$lib/stores';
	import { SKELETON_TCP_WIDTHS } from '$lib/constants';
	import { formatMem, scopeLabel } from '$lib/utils';
	import ActionCell from './action-cell.svelte';
	import DetailPanel from './detail-panel.svelte';
	import Icon from './icon.svelte';
	import ListRow from './list-row.svelte';
	import StatusDot from './status-dot.svelte';

	const cols =
		'grid-cols-[14px_54px_minmax(0,1fr)_50px_52px_62px_96px_20px] max-[680px]:grid-cols-[14px_48px_minmax(0,1fr)_92px_20px]';
	const head =
		'grid min-h-[32px] items-center gap-[0.7rem] px-[0.85rem] sticky top-[84px] z-20 border-b border-border bg-bg text-[10.5px] font-medium uppercase tracking-[0.07em] text-faint';
	const hide = 'max-[680px]:hidden';
	const metric = 'min-w-0 text-right font-mono text-[11.5px] text-muted tabular-nums';
</script>

<div class="{head} {cols}" role="row">
	<span class="min-w-0"></span>
	<span class="min-w-0">Port</span>
	<span class="min-w-0">Process</span>
	<span class="min-w-0 text-right {hide}">CPU</span>
	<span class="min-w-0 text-right {hide}">Mem</span>
	<span class="min-w-0 text-right {hide}">PID</span>
	<span class="min-w-0"></span>
	<span class="min-w-0"></span>
</div>

{#if !app.portsReady}
	{#each SKELETON_TCP_WIDTHS as w, i (i)}
		<div class="grid min-h-[40px] items-center gap-[0.7rem] px-[0.85rem] {cols}" aria-hidden="true">
			<span class="min-w-0"><StatusDot skeleton /></span>
			<span class="min-w-0"><span class="sk" style="width: 34px; height: 10px"></span></span>
			<span class="min-w-0"><span class="sk" style="width: {w}%; height: 10px"></span></span>
			<span class="min-w-0 text-right {hide}"><span class="sk" style="width: 28px; height: 10px"></span></span>
			<span class="min-w-0 text-right {hide}"><span class="sk" style="width: 28px; height: 10px"></span></span>
			<span class="min-w-0 text-right {hide}"><span class="sk" style="width: 40px; height: 10px"></span></span>
			<span class="min-w-0"></span>
			<span class="min-w-0"></span>
		</div>
	{/each}
{:else if app.visiblePorts.length === 0}
	<p class="px-4 py-12 text-center text-[13px] text-muted">
		{app.filter ? 'No ports match the filter.' : 'No listening TCP ports. All quiet.'}
	</p>
{:else}
	{#each app.visiblePorts as p, i (p.pid + ':' + p.port)}
		{@const key = app.keyFor('tcp', p)}
		<ListRow
			{cols}
			open={app.isOpen(key)}
			idx={i}
			risk={p.risk}
			onclick={(e) => app.rowClick(e, key, 'tcp', p.pid)}
			onkeydown={(e) => app.rowKey(e, i, key, 'tcp', p.pid, p.risk === 'system')}
		>
			<span class="min-w-0"><StatusDot risk={p.risk} title={p.riskNote} /></span>
			<span class="min-w-0 font-mono text-[13px] font-semibold tracking-[-0.02em] tabular-nums">{p.port}</span>
			<span class="flex min-w-0 items-baseline gap-2">
				<span class="truncate font-medium" title={p.fullCommand}>{p.command || '—'}</span>
				<span class="shrink truncate font-mono text-[11px] text-faint">{scopeLabel(p.address)}</span>
				{#if p.risk !== 'safe'}
					<span
						class="flex-none text-[10px] font-semibold uppercase tracking-[0.05em] {p.risk === 'system'
							? 'text-danger'
							: 'text-warn'}">{p.risk}</span>
				{/if}
			</span>
			<span class="{metric} {hide}">{p.cpu != null ? p.cpu + '%' : '·'}</span>
			<span class="{metric} {hide}">{p.rssMb != null ? formatMem(p.rssMb) : '·'}</span>
			<span class="min-w-0 text-right font-mono text-[11.5px] text-faint tabular-nums {hide}">{p.pid}</span>
			<ActionCell kind="tcp" id={p.pid} locked={p.risk === 'system'} />
			<span class="flex min-w-0 items-center justify-center text-faint">
				<Icon name="chevron" open={app.isOpen(key)} />
			</span>
		</ListRow>
		{#if app.isOpen(key)}<DetailPanel entryKey={key} kind="tcp" />{/if}
	{/each}
{/if}
