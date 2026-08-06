<script lang="ts">
	import type { DotState, Risk } from '$lib/types';

	let {
		risk,
		state,
		skeleton = false,
		title
	}: { risk?: Risk | 'running'; state?: DotState; skeleton?: boolean; title?: string } = $props();

	const color = $derived(
		skeleton
			? 'bg-sk-hi'
			: state === 'off'
				? 'bg-faint'
				: state === 'bad' || risk === 'system'
					? 'bg-danger'
					: state === 'warn' || risk === 'caution'
						? 'bg-warn'
						: 'bg-ok'
	);
</script>

<span class="inline-block h-1.5 w-1.5 rounded-full {color}" {title}></span>
