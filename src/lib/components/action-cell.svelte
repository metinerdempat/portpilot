<script lang="ts">
	import { app } from '$lib/stores';
	import type { View } from '$lib/types';
	import Icon from './icon.svelte';

	let { kind, id, locked, copy }: { kind: View; id: number | string; locked: boolean; copy?: number } =
		$props();

	const active = $derived(kind === 'tcp' ? app.confirming === id : app.dconfirming === id);
	const busy = $derived(kind === 'tcp' ? app.killing === id : app.busyId === id);

	const base =
		'inline-flex h-[26px] w-[26px] items-center justify-center rounded-md transition-colors disabled:cursor-default disabled:opacity-50';
	const neutral = `${base} text-muted enabled:hover:bg-hover enabled:hover:text-text`;
	const force = `${base} text-muted enabled:hover:bg-hover enabled:hover:text-danger`;
	const danger = `${base} text-muted enabled:hover:text-danger enabled:hover:bg-[color-mix(in_srgb,var(--danger)_12%,transparent)]`;
	const dangerReveal = `${danger} opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100`;
	const killBtn =
		'rounded-md bg-danger px-[0.55rem] py-[0.24rem] text-xs font-semibold whitespace-nowrap text-white transition-colors enabled:hover:bg-danger-strong disabled:cursor-default disabled:opacity-65';
</script>

<span class="flex items-center justify-end gap-[0.28rem]">
	{#if locked}
		<span
			class="{base} cursor-not-allowed text-faint"
			role="img"
			aria-label="Protected system process"
			data-tip="Protected — can’t kill"
		>
			<Icon name="lock" />
		</span>
	{:else if active}
		<span class="inline-flex items-center gap-[0.22rem]">
			<button class={killBtn} onclick={() => app.confirmAction(kind, id)} disabled={busy}>
				{busy ? '…' : kind === 'tcp' ? 'Kill' : 'Stop'}
			</button>
			{#if kind === 'tcp'}
				<button
					class={force}
					onclick={() => app.kill(id as number, true)}
					disabled={busy}
					data-tip="Force · SIGKILL"
					aria-label="Force kill"
				>
					<Icon name="zap" />
				</button>
			{/if}
			<button
				class={neutral}
				onclick={() => app.cancelAction(kind)}
				disabled={busy}
				data-tip="Cancel"
				aria-label="Cancel"
			>
				<Icon name="x" />
			</button>
		</span>
	{:else}
		{#if copy != null}
			<button
				class={neutral}
				onclick={() => app.copyText('localhost:' + copy)}
				data-tip={'Copy localhost:' + copy}
				aria-label="Copy address"
			>
				<Icon name="copy" />
			</button>
		{/if}
		{#if kind === 'docker'}
			<button
				class={neutral}
				onclick={() => app.containerDo(id as string, 'restart')}
				disabled={busy}
				data-tip="Restart container"
				aria-label="Restart container"
			>
				<Icon name="restart" />
			</button>
		{/if}
		<button
			class={dangerReveal}
			onclick={() => app.beginAction(kind, id)}
			data-tip={kind === 'tcp' ? 'Kill port' : 'Stop container'}
			aria-label={kind === 'tcp' ? 'Kill port' : 'Stop container'}
		>
			{#if kind === 'tcp'}<Icon name="power" />{:else}<Icon name="stop" />{/if}
		</button>
	{/if}
</span>
