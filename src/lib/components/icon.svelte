<script lang="ts">
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
</script>

{#if name === 'chevron'}
	<svg class="chev" class:open viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
{:else if name === 'power'}
	<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 4v8" /><path d="M7.6 7.2a7 7 0 1 0 8.8 0" /></svg>
{:else if name === 'stop'}
	<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2.5" /></svg>
{:else if name === 'zap'}
	<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true"><path d="M13 2L4 14h6l-1 8 9-12h-6z" /></svg>
{:else if name === 'x'}
	<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
{:else if name === 'lock'}
	<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
{:else if name === 'copy'}
	<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>
{:else if name === 'restart'}
	<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 2.6-6.4" /><path d="M3 4v5h5" /></svg>
{:else if name === 'play'}
	<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true"><path d="M7 5v14l11-7z" /></svg>
{:else if name === 'search'}
	<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.2-3.2" /></svg>
{/if}

<style>
	svg.chev {
		transition: transform 0.16s ease;
	}
	svg.chev.open {
		transform: rotate(90deg);
	}
	@media (prefers-reduced-motion: reduce) {
		svg.chev {
			transition: none;
		}
	}
</style>
