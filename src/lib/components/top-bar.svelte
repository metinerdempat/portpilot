<script lang="ts">
	import { app } from '$lib/stores';

	const tabs = [
		['tcp', 'TCP'],
		['docker', 'Docker'],
		['containers', 'Containers']
	] as const;
</script>

<header
	class="sticky top-0 z-30 flex h-[46px] items-center gap-3 border-b border-border bg-[color-mix(in_srgb,var(--bg)_88%,transparent)] px-[0.85rem] backdrop-blur-[8px]"
>
	<div class="flex items-center gap-1.5">
		<span
			class="h-[7px] w-[7px] rounded-full bg-ok motion-safe:animate-[pulse-ring_2.4s_ease-out_infinite]"
			aria-hidden="true"
		></span>
		<span class="font-semibold tracking-[-0.01em]">deport</span>
	</div>

	<nav class="ml-1.5 flex gap-px" aria-label="View">
		{#each tabs as [value, label] (value)}
			<button
				class="rounded-[5px] px-[0.55rem] py-1 text-[12.5px] font-medium transition-colors {app.view ===
				value
					? 'bg-[color-mix(in_srgb,var(--accent)_15%,transparent)] text-text'
					: 'text-muted hover:bg-hover hover:text-text'}"
				onclick={() => app.switchView(value)}
			>
				{label}
			</button>
		{/each}
	</nav>

	<div class="flex-1"></div>

	<div class="whitespace-nowrap text-[12.5px] text-muted max-[680px]:hidden" aria-live="polite">
		{#if app.view === 'tcp' && app.portsReady}
			<span class="font-semibold tabular-nums text-text">{app.ports.length}</span> ports{#if app.riskyCount > 0}<span
					class="mx-[0.3rem] text-faint">·</span
				><span class="text-warn">{app.riskyCount} risky</span>{/if}
		{:else if app.view === 'docker' && app.dockerReady && app.dockerAvailable}
			<span class="font-semibold tabular-nums text-text">{app.dports.length}</span> published
		{:else if app.view === 'containers' && app.containersReady && app.containerAvail}
			<span class="font-semibold tabular-nums text-text">{app.runningContainers}</span> /
			{app.containers.length} up
		{/if}
	</div>

	{#if app.updatedAt}
		<time class="font-mono text-[11.5px] tabular-nums text-faint max-[680px]:hidden">{app.updatedAt}</time>
	{/if}

	<label
		class="tip-below inline-flex cursor-pointer select-none items-center gap-[0.32rem] text-xs text-muted"
		data-tip="Refresh every 3s"
	>
		<input type="checkbox" bind:checked={app.autoRefresh} class="h-[13px] w-[13px] accent-accent" />
		<span>auto</span>
	</label>

	<button
		class="tip-below rounded-md border border-border-strong bg-panel px-[0.6rem] py-[0.28rem] text-xs font-medium text-text transition-colors hover:border-muted hover:bg-hover"
		onclick={app.refresh}
		data-tip="Refresh now"
	>
		Refresh
	</button>
</header>
