<script lang="ts">
	import { app } from '$lib/stores';
	import type { View } from '$lib/types';

	let { entryKey, kind }: { entryKey: string; kind: View } = $props();

	const d = $derived(app.details[entryKey]);

	const facts = 'flex flex-wrap gap-x-8 gap-y-[0.35rem]';
	const fact = 'flex items-baseline gap-2';
	const dt = 'm-0 text-[10.5px] uppercase tracking-[0.06em] text-faint';
	const dd = 'm-0 font-mono text-xs text-text tabular-nums';
</script>

<div
	class="bg-hover px-[0.85rem] pt-[0.35rem] pb-[0.85rem] pl-[3.2rem] motion-safe:animate-[detail-fade_0.15s_ease]"
>
	{#if !d || d.loading}
		<div class={facts}>
			{#each [70, 54, 88, 60] as w (w)}
				<div class={fact}>
					<span class="sk" style="width: 34px; height: 8px"></span>
					<span class="sk" style="width: {w}px; height: 9px"></span>
				</div>
			{/each}
		</div>
	{:else if d.error}
		<p class="m-0 text-xs text-danger">{d.error}</p>
	{:else if kind === 'tcp' && d.data}
		{@const x = d.data}
		<div class={facts}>
			<div class={fact}><dt class={dt}>Memory</dt><dd class={dd}>{x.rssMb} MB · {x.mem}%</dd></div>
			<div class={fact}><dt class={dt}>Uptime</dt><dd class={dd}>{x.uptime}</dd></div>
			<div class={fact}><dt class={dt}>Parent</dt><dd class={dd}>PID {x.ppid}</dd></div>
		</div>
		<div class="mt-[0.65rem] flex flex-col gap-[0.28rem]">
			<dt class={dt}>Command</dt>
			<code class="font-mono text-[11.5px] leading-[1.5] break-all text-muted">{x.command}</code>
		</div>
	{:else if d.data}
		{@const x = d.data}
		<div class={facts}>
			<div class={fact}><dt class={dt}>CPU</dt><dd class={dd}>{x.cpu}</dd></div>
			<div class={fact}><dt class={dt}>Memory</dt><dd class={dd}>{x.mem} · {x.memPerc}</dd></div>
			<div class={fact}><dt class={dt}>Network I/O</dt><dd class={dd}>{x.net}</dd></div>
			<div class={fact}><dt class={dt}>Disk I/O</dt><dd class={dd}>{x.block}</dd></div>
			<div class={fact}><dt class={dt}>Processes</dt><dd class={dd}>{x.pids}</dd></div>
		</div>
	{/if}
</div>
