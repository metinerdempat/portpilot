<script lang="ts">
	import { app } from '$lib/stores';
	import { SKELETON_DOCKER_WIDTHS } from '$lib/constants';
	import ContainerActions from './container-actions.svelte';
	import Icon from './icon.svelte';
	import ListRow from './list-row.svelte';
	import LogsPanel from './logs-panel.svelte';
	import StatusDot from './status-dot.svelte';

	const cols =
		'grid-cols-[14px_minmax(0,1.15fr)_minmax(0,0.85fr)_130px_96px_84px_20px] max-[680px]:grid-cols-[14px_minmax(0,1fr)_84px_20px]';
	const head =
		'grid min-h-[32px] items-center gap-[0.7rem] px-[0.85rem] sticky top-[84px] z-20 border-b border-border bg-bg text-[10.5px] font-medium uppercase tracking-[0.07em] text-faint';
	const hide = 'max-[680px]:hidden';
</script>

<div class="{head} {cols}" role="row">
	<span class="min-w-0"></span>
	<span class="min-w-0">Container</span>
	<span class="min-w-0 {hide}">Image</span>
	<span class="min-w-0 {hide}">Status</span>
	<span class="min-w-0 {hide}">Ports</span>
	<span class="min-w-0"></span>
	<span class="min-w-0"></span>
</div>

{#if !app.containersReady}
	{#each SKELETON_DOCKER_WIDTHS as w, i (i)}
		<div class="grid min-h-[40px] items-center gap-[0.7rem] px-[0.85rem] {cols}" aria-hidden="true">
			<span class="min-w-0"><StatusDot skeleton /></span>
			<span class="min-w-0"><span class="sk" style="width: {w}%; height: 10px"></span></span>
			<span class="min-w-0 {hide}"><span class="sk" style="width: 58px; height: 10px"></span></span>
			<span class="min-w-0 {hide}"><span class="sk" style="width: 70px; height: 10px"></span></span>
			<span class="min-w-0 {hide}"><span class="sk" style="width: 44px; height: 10px"></span></span>
			<span class="min-w-0"></span>
			<span class="min-w-0"></span>
		</div>
	{/each}
{:else if !app.containerAvail}
	<div class="mx-[0.85rem] my-6 rounded-lg border border-border-strong p-[1.3rem] text-center">
		<p class="m-0 font-semibold">Docker unavailable</p>
		<p class="mt-[0.35rem] mb-0 text-[12.5px] text-muted">{app.containerReason ?? 'Could not reach Docker.'}</p>
		<p class="mt-[0.8rem] mb-0 text-xs text-faint">
			Start Docker Desktop and
			<button class="border-0 bg-transparent p-0 text-accent underline underline-offset-2 [font:inherit]" onclick={app.refresh}
				>try again</button
			>.
		</p>
	</div>
{:else if app.visibleContainers.length === 0}
	<p class="px-4 py-12 text-center text-[13px] text-muted">
		{app.filter ? 'No containers match the filter.' : 'No containers.'}
	</p>
{:else}
	{#each app.visibleContainers as c, i (c.id)}
		{@const key = 'cont:' + c.id}
		{@const dotState = c.running
			? c.health === 'unhealthy'
				? 'bad'
				: c.health === 'starting'
					? 'warn'
					: 'ok'
			: 'off'}
		{#if i === 0 || c.project !== app.visibleContainers[i - 1]?.project}
			<div class="pt-[0.75rem] pr-[0.85rem] pb-[0.2rem] pl-[2.5rem] text-[10.5px] font-semibold uppercase tracking-[0.07em] text-faint">
				{c.project ?? 'ungrouped'}
			</div>
		{/if}
		<ListRow
			{cols}
			open={app.isOpen(key)}
			idx={i}
			onclick={(e) => app.rowClick(e, key, 'containers', c.id)}
			onkeydown={(e) => app.rowKey(e, i, key, 'containers', c.id, false)}
		>
			<span class="min-w-0"><StatusDot state={dotState} /></span>
			<span class="flex min-w-0 items-baseline gap-2">
				<span class="truncate font-medium">{c.name}</span>
				{#if c.service}<span class="shrink truncate font-mono text-[11px] text-faint">{c.service}</span>{/if}
			</span>
			<span class="min-w-0 truncate font-mono text-[11.5px] text-muted {hide}">{c.image}</span>
			<span class="min-w-0 truncate text-[11.5px] {c.running ? 'text-muted' : 'text-faint'} {hide}">{c.status}</span>
			<span class="min-w-0 truncate font-mono text-[11.5px] text-faint {hide}">{c.ports}</span>
			<ContainerActions container={c} />
			<span class="flex min-w-0 items-center justify-center text-faint">
				<Icon name="chevron" open={app.isOpen(key)} />
			</span>
		</ListRow>
		{#if app.isOpen(key)}<LogsPanel entryKey={key} />{/if}
	{/each}
{/if}
