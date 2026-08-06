<script lang="ts">
	import { app } from '$lib/stores';

	let { entryKey }: { entryKey: string } = $props();

	const d = $derived(app.details[entryKey]);
</script>

<div
	class="bg-hover px-[0.85rem] pt-[0.4rem] pb-[0.85rem] pl-[2.5rem] motion-safe:animate-[detail-fade_0.15s_ease]"
>
	{#if !d || d.loading}
		<div class="flex flex-col gap-[0.4rem]">
			{#each [92, 74, 86, 60, 80] as w (w)}
				<span class="sk" style="width: {w}%; height: 9px"></span>
			{/each}
		</div>
	{:else if d.error}
		<p class="m-0 text-xs text-danger">{d.error}</p>
	{:else}
		<pre
			class="m-0 max-h-[300px] overflow-auto rounded-md border border-border bg-bg px-[0.7rem] py-[0.6rem] font-mono text-[11px] leading-[1.55] break-all whitespace-pre-wrap text-muted">{d.data
				?.logs || '(no output)'}</pre>
	{/if}
</div>
