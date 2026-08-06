<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { Risk } from '$lib/types';

	let {
		cols,
		open = false,
		idx,
		risk,
		onclick,
		onkeydown,
		children
	}: {
		cols: string;
		open?: boolean;
		idx?: number;
		risk?: Risk;
		onclick?: (e: MouseEvent) => void;
		onkeydown?: (e: KeyboardEvent) => void;
		children: Snippet;
	} = $props();
</script>

<div
	class="group grid min-h-[40px] cursor-pointer items-center gap-[0.7rem] px-[0.85rem] hover:bg-hover focus-visible:bg-selected focus-visible:shadow-[inset_2px_0_0_var(--accent)] focus-visible:outline-none {cols} {open
		? 'bg-hover'
		: ''}"
	data-idx={idx}
	data-risk={risk}
	role="row"
	tabindex="0"
	{onclick}
	{onkeydown}
>
	{@render children()}
</div>
