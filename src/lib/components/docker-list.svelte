<script lang="ts">
	import { app } from '$lib/stores';
	import { SKELETON_DOCKER_WIDTHS } from '$lib/constants';
	import { scopeLabel } from '$lib/utils';
	import ActionCell from './action-cell.svelte';
	import DetailPanel from './detail-panel.svelte';
	import Icon from './icon.svelte';
	import ListRow from './list-row.svelte';
	import StatusDot from './status-dot.svelte';

	const cols =
		'grid-cols-[14px_54px_minmax(0,1fr)_118px_96px_20px] max-[680px]:grid-cols-[14px_48px_minmax(0,1fr)_92px_20px]';
	const head =
		'grid min-h-[32px] items-center gap-[0.7rem] px-[0.85rem] sticky top-[84px] z-20 border-b border-border bg-bg text-[10.5px] font-medium uppercase tracking-[0.07em] text-faint';
	const hide = 'max-[680px]:hidden';
</script>

<div class="{head} {cols}" role="row">
	<span class="min-w-0"></span>
	<span class="min-w-0">Port</span>
	<span class="min-w-0">Container</span>
	<span class="min-w-0 {hide}">Internal</span>
	<span class="min-w-0"></span>
	<span class="min-w-0"></span>
</div>

{#if !app.dockerReady}
	{#each SKELETON_DOCKER_WIDTHS as w, i (i)}
		<div class="grid min-h-[40px] items-center gap-[0.7rem] px-[0.85rem] {cols}" aria-hidden="true">
			<span class="min-w-0"><StatusDot skeleton /></span>
			<span class="min-w-0"><span class="sk" style="width: 34px; height: 10px"></span></span>
			<span class="min-w-0"><span class="sk" style="width: {w}%; height: 10px"></span></span>
			<span class="min-w-0 {hide}"><span class="sk" style="width: 64px; height: 10px"></span></span>
			<span class="min-w-0"></span>
			<span class="min-w-0"></span>
		</div>
	{/each}
{:else if !app.dockerAvailable}
	<div class="mx-[0.85rem] my-6 rounded-lg border border-border-strong p-[1.3rem] text-center">
		<p class="m-0 font-semibold">Docker unavailable</p>
		<p class="mt-[0.35rem] mb-0 text-[12.5px] text-muted">{app.dockerReason ?? 'Could not reach Docker.'}</p>
		<p class="mt-[0.8rem] mb-0 text-xs text-faint">
			Start Docker Desktop and
			<button class="border-0 bg-transparent p-0 text-accent underline underline-offset-2 [font:inherit]" onclick={app.refresh}
				>try again</button
			>.
		</p>
	</div>
{:else if app.visibleDports.length === 0}
	<p class="px-4 py-12 text-center text-[13px] text-muted">
		{app.filter ? 'No ports match the filter.' : 'No published Docker ports.'}
	</p>
{:else}
	{#each app.visibleDports as d, i (d.containerId + ':' + d.hostPort + ':' + d.protocol)}
		{@const key = app.keyFor('docker', d)}
		<ListRow
			{cols}
			open={app.isOpen(key)}
			idx={i}
			onclick={(e) => app.rowClick(e, key, 'docker', d.containerId)}
			onkeydown={(e) => app.rowKey(e, i, key, 'docker', d.containerId, false)}
		>
			<span class="min-w-0"><StatusDot risk="running" /></span>
			<span class="min-w-0 font-mono text-[13px] font-semibold tracking-[-0.02em] tabular-nums">{d.hostPort}</span>
			<span class="flex min-w-0 items-baseline gap-2">
				<span class="truncate font-medium">{d.container}</span>
				<span class="shrink truncate font-mono text-[11px] text-faint">{d.image}</span>
				<span class="shrink truncate font-mono text-[11px] text-faint opacity-75">{scopeLabel(d.address)}</span>
			</span>
			<span class="min-w-0 font-mono text-[11.5px] text-muted {hide}">→ {d.containerPort}/{d.protocol}</span>
			<ActionCell kind="docker" id={d.containerId} locked={false} copy={d.hostPort} />
			<span class="flex min-w-0 items-center justify-center text-faint">
				<Icon name="chevron" open={app.isOpen(key)} />
			</span>
		</ListRow>
		{#if app.isOpen(key)}<DetailPanel entryKey={key} kind="docker" />{/if}
	{/each}
{/if}
