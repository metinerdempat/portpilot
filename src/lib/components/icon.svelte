<script lang="ts">
	import {
		ChevronRight,
		Copy,
		Lock,
		Play,
		Power,
		RotateCcw,
		Search,
		Square,
		X,
		Zap
	} from 'lucide-svelte';

	type IconName =
		| 'chevron'
		| 'power'
		| 'stop'
		| 'zap'
		| 'x'
		| 'lock'
		| 'copy'
		| 'restart'
		| 'play'
		| 'search';

	let { name, open = false }: { name: IconName; open?: boolean } = $props();

	const icons = {
		chevron: ChevronRight,
		power: Power,
		stop: Square,
		zap: Zap,
		x: X,
		lock: Lock,
		copy: Copy,
		restart: RotateCcw,
		play: Play,
		search: Search
	};

	const Glyph = $derived(icons[name]);
</script>

{#if name === 'chevron'}
	<span class="chev" class:open><Glyph size={15} strokeWidth={2.25} /></span>
{:else}
	<Glyph size={name === 'stop' || name === 'play' ? 13 : 14} strokeWidth={2} />
{/if}

<style>
	.chev {
		display: inline-flex;
		transition: transform 0.16s ease;
	}
	.chev.open {
		transform: rotate(90deg);
	}
	@media (prefers-reduced-motion: reduce) {
		.chev {
			transition: none;
		}
	}
</style>
