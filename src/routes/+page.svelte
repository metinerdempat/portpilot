<script lang="ts">
	import { onMount } from 'svelte';
	import {
		ContainerList,
		DockerList,
		FilterBar,
		StatusBar,
		TcpList,
		TopBar
	} from '$lib/components';
	import { app } from '$lib/stores';

	onMount(app.refresh);

	$effect(() => {
		if (!app.autoRefresh) return;
		const id = setInterval(app.refresh, app.refreshMs);
		return () => clearInterval(id);
	});
</script>

<svelte:window onkeydown={app.onGlobalKey} />

<svelte:head>
	<title>deport — ports & docker</title>
</svelte:head>

<div class="mx-auto flex min-h-screen max-w-[1040px] flex-col border-x border-border max-[680px]:border-x-0">
	<TopBar />

	<FilterBar />

	{#if app.error}
		<div
			class="mx-[0.85rem] mt-[0.7rem] rounded-md border border-[color-mix(in_srgb,var(--danger)_45%,var(--border))] bg-[color-mix(in_srgb,var(--danger)_8%,transparent)] px-[0.75rem] py-[0.55rem] text-[12.5px] text-danger"
			role="alert"
		>
			{app.error}
		</div>
	{/if}

	<main class="flex-1 pb-2">
		{#if app.view === 'tcp'}
			<TcpList />
		{:else if app.view === 'docker'}
			<DockerList />
		{:else}
			<ContainerList />
		{/if}
	</main>

	<StatusBar />
</div>
