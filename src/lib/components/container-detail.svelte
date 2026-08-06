<script lang="ts">
	import { app } from '$lib/stores';
	import LogsPanel from './logs-panel.svelte';

	let { entryKey, id }: { entryKey: string; id: string } = $props();

	const ins = $derived(app.inspects[entryKey]);

	const label = 'mb-[0.2rem] text-[10.5px] font-semibold uppercase tracking-[0.06em] text-faint';
	const dt = 'm-0 text-[10.5px] uppercase tracking-[0.06em] text-faint';
	const dd = 'm-0 font-mono text-xs text-text tabular-nums';
</script>

<div
	class="bg-hover px-[0.85rem] pt-[0.4rem] pb-[0.85rem] pl-[2.5rem] motion-safe:animate-[detail-fade_0.15s_ease]"
>
	{#if !ins || ins.loading}
		<div class="flex flex-col gap-[0.4rem]">
			{#each [120, 90] as w (w)}
				<span class="sk" style="width: {w}px; height: 9px"></span>
			{/each}
		</div>
	{:else if ins.error}
		<p class="m-0 text-xs text-danger">{ins.error}</p>
	{:else if ins.data}
		{@const d = ins.data}
		{#if d.restartPolicy || (d.restartCount ?? 0) > 0}
			<div class="mb-[0.55rem] flex flex-wrap gap-x-8 gap-y-[0.35rem]">
				{#if d.restartPolicy}
					<div class="flex items-baseline gap-2"><dt class={dt}>Restart</dt><dd class={dd}>{d.restartPolicy}</dd></div>
				{/if}
				{#if (d.restartCount ?? 0) > 0}
					<div class="flex items-baseline gap-2"><dt class={dt}>Restarts</dt><dd class={dd}>{d.restartCount}</dd></div>
				{/if}
			</div>
		{/if}

		<div class="mb-[0.55rem]">
			<div class={label}>Networks</div>
			{#if d.networks.length === 0}
				<div class="font-mono text-[11.5px] text-faint">none</div>
			{:else}
				<div class="flex flex-col gap-[0.15rem]">
					{#each d.networks as n (n.name)}
						<div class="flex items-baseline gap-2 font-mono text-[11.5px]">
							<span class="text-text">{n.name}</span>
							<span class="text-faint">{n.ip}</span>
							{#if n.gateway}<span class="text-faint opacity-70">gw {n.gateway}</span>{/if}
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<div>
			<div class={label}>Mounts</div>
			{#if d.mounts.length === 0}
				<div class="font-mono text-[11.5px] text-faint">none</div>
			{:else}
				<div class="flex flex-col gap-[0.2rem]">
					{#each d.mounts as m, i (i)}
						<div class="flex min-w-0 items-baseline gap-2 font-mono text-[11.5px]">
							<span class="shrink-0 text-text">{m.destination}</span>
							<span class="shrink-0 text-faint">←</span>
							<span class="truncate text-muted" title={m.source}>{m.source}</span>
							<span class="shrink-0 text-[10px] uppercase tracking-[0.04em] text-faint">
								{m.type}{m.rw ? '' : ' · ro'}
							</span>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/if}

	<LogsPanel {id} />
</div>
