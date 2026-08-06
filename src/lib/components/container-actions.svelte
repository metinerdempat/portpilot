<script lang="ts">
	import { app } from '$lib/stores';
	import type { ContainerInfo } from '$lib/types';
	import Icon from './icon.svelte';

	let { container }: { container: ContainerInfo } = $props();

	const busy = $derived(app.busyId === container.id);

	const base =
		'inline-flex h-[26px] w-[26px] items-center justify-center rounded-md transition-colors disabled:cursor-default disabled:opacity-50';
	const neutral = `${base} text-muted enabled:hover:bg-hover enabled:hover:text-text`;
	const danger = `${base} text-muted enabled:hover:text-danger enabled:hover:bg-[color-mix(in_srgb,var(--danger)_12%,transparent)]`;
	const dangerReveal = `${danger} opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100`;
	const go = `${base} text-ok enabled:hover:bg-[color-mix(in_srgb,var(--ok)_14%,transparent)]`;
	const killBtn =
		'rounded-md bg-danger px-[0.55rem] py-[0.24rem] text-xs font-semibold whitespace-nowrap text-white transition-colors enabled:hover:bg-danger-strong disabled:cursor-default disabled:opacity-65';
</script>

<span class="flex items-center justify-end gap-[0.28rem]">
	{#if app.dconfirming === container.id}
		<span class="inline-flex items-center gap-[0.22rem]">
			<button class={killBtn} onclick={() => app.containerDo(container.id, 'stop')} disabled={busy}>
				{busy ? '…' : 'Stop'}
			</button>
			<button
				class={neutral}
				onclick={() => (app.dconfirming = null)}
				disabled={busy}
				data-tip="Cancel"
				aria-label="Cancel"
			>
				<Icon name="x" />
			</button>
		</span>
	{:else if container.running}
		<button
			class={neutral}
			onclick={() => app.containerDo(container.id, 'restart')}
			disabled={busy}
			data-tip="Restart"
			aria-label="Restart"
		>
			<Icon name="restart" />
		</button>
		<button
			class={dangerReveal}
			onclick={() => (app.dconfirming = container.id)}
			disabled={busy}
			data-tip="Stop"
			aria-label="Stop"
		>
			<Icon name="stop" />
		</button>
	{:else}
		<button
			class={go}
			onclick={() => app.containerDo(container.id, 'start')}
			disabled={busy}
			data-tip="Start"
			aria-label="Start"
		>
			<Icon name="play" />
		</button>
	{/if}
</span>
