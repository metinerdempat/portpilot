<script lang="ts">
	import { app } from '$lib/stores';
	import Icon from './icon.svelte';
</script>

<div
	class="sticky top-[46px] z-[25] flex h-[38px] items-center gap-2 border-b border-border bg-bg px-[0.85rem]"
>
	<span class="flex shrink-0 items-center text-faint"><Icon name="search" /></span>
	<input
		bind:this={app.filterEl}
		bind:value={app.filter}
		class="flex-1 border-0 bg-transparent p-0 text-[13px] text-text outline-none placeholder:text-faint"
		type="text"
		placeholder="Filter by port, process, container…"
		spellcheck="false"
		autocomplete="off"
		aria-label="Filter"
	/>
	{#if app.filter}
		<button
			class="inline-flex h-5 w-5 items-center justify-center rounded border-0 bg-transparent text-faint hover:bg-hover hover:text-text"
			onclick={() => (app.filter = '')}
			aria-label="Clear filter"
		>
			<Icon name="x" />
		</button>
	{:else}
		<kbd
			class="rounded border border-border-strong px-[0.32rem] py-[0.05rem] font-mono text-[11px] leading-[1.4] text-faint"
			>/</kbd
		>
	{/if}
</div>
