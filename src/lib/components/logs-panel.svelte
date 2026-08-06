<script lang="ts">
	import { splitHighlight } from '$lib/utils';
	import Icon from './icon.svelte';

	let { id }: { id: string } = $props();

	let logText = $state('');
	let streaming = $state(true);
	let streamError = $state<string | null>(null);
	let query = $state('');
	let boxEl = $state<HTMLDivElement | null>(null);
	let atBottom = true;

	const lines = $derived.by(() => {
		if (!logText) return [];
		const body = logText.endsWith('\n') ? logText.slice(0, -1) : logText;
		return body.split('\n');
	});
	const q = $derived(query.trim());
	const filtered = $derived(q ? lines.filter((l) => l.toLowerCase().includes(q.toLowerCase())) : lines);
	// Cap the rendered rows so a chatty container can't balloon the DOM.
	const displayed = $derived(filtered.length > 1500 ? filtered.slice(-1500) : filtered);

	// Open a live SSE stream for the container; re-runs if the id changes.
	$effect(() => {
		const cid = id;
		logText = '';
		streaming = true;
		streamError = null;
		let ended = false;

		const source = new EventSource(`/api/docker/logs/stream?id=${encodeURIComponent(cid)}&tail=200`);
		source.addEventListener('log', (e) => {
			logText += (e as MessageEvent).data;
			if (logText.length > 200000) logText = logText.slice(-200000);
		});
		source.addEventListener('end', () => {
			ended = true;
			streaming = false;
			source.close();
		});
		source.onerror = () => {
			if (ended) return;
			streamError = 'Log stream interrupted.';
			streaming = false;
			source.close();
		};

		return () => source.close();
	});

	// Keep the view pinned to the tail while live and not searching.
	$effect(() => {
		void displayed.length;
		if (atBottom && !q && boxEl) boxEl.scrollTop = boxEl.scrollHeight;
	});

	const onScroll = () => {
		if (!boxEl) return;
		atBottom = boxEl.scrollHeight - boxEl.scrollTop - boxEl.clientHeight < 24;
	};
</script>

<div class="mt-[0.6rem]">
	<div class="mb-[0.4rem] flex items-center gap-2">
		<span class="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-faint">Logs</span>

		<label class="flex flex-1 items-center gap-1.5 text-faint">
			<Icon name="search" />
			<input
				bind:value={query}
				class="min-w-0 flex-1 bg-transparent text-[12px] text-text outline-none placeholder:text-faint"
				type="text"
				placeholder="Search logs…"
				spellcheck="false"
				autocomplete="off"
				aria-label="Search logs"
			/>
		</label>

		{#if q}
			<span class="font-mono text-[11px] tabular-nums text-faint">{filtered.length}/{lines.length}</span>
			<button
				class="inline-flex h-5 w-5 items-center justify-center rounded text-faint hover:bg-hover hover:text-text"
				onclick={() => (query = '')}
				aria-label="Clear log search"
			>
				<Icon name="x" />
			</button>
		{/if}

		<span
			class="inline-flex items-center gap-1 text-[10.5px] font-medium uppercase tracking-[0.05em] {streamError
				? 'text-danger'
				: streaming
					? 'text-ok'
					: 'text-faint'}"
		>
			{#if streaming && !streamError}
				<span
					class="h-[6px] w-[6px] rounded-full bg-ok motion-safe:animate-[pulse-ring_2.4s_ease-out_infinite]"
					aria-hidden="true"
				></span>
				live
			{:else if streamError}
				error
			{:else}
				ended
			{/if}
		</span>
	</div>

	<div
		bind:this={boxEl}
		onscroll={onScroll}
		class="m-0 max-h-[300px] overflow-auto rounded-md border border-border bg-bg px-[0.7rem] py-[0.6rem] font-mono text-[11px] leading-[1.55] text-muted"
	>
		{#if displayed.length === 0}
			<div class="text-faint">
				{q ? 'No matching lines.' : streaming ? 'Waiting for output…' : '(no output)'}
			</div>
		{:else}
			{#each displayed as line, i (i)}
				<div class="break-all whitespace-pre-wrap">
					{#if q}
						{#each splitHighlight(line, q) as part, pi (pi)}{#if part.hit}<mark
									class="rounded-[2px] bg-[color-mix(in_srgb,var(--warn)_38%,transparent)] text-text">{part.text}</mark
								>{:else}{part.text}{/if}{/each}
					{:else}{line}{/if}
				</div>
			{/each}
		{/if}
	</div>
</div>
