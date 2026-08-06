<script lang="ts">
	import { onMount } from 'svelte';

	interface PortEntry {
		port: number;
		pid: number;
		command: string;
		user: string;
		address: string;
		protocol: string;
		risk: 'safe' | 'caution' | 'system';
		riskNote?: string;
	}

	interface DockerPort {
		hostPort: number;
		containerPort: number;
		protocol: string;
		address: string;
		container: string;
		image: string;
		containerId: string;
	}

	type View = 'tcp' | 'docker';

	let view = $state<View>('tcp');

	// ---- tcp ports ----
	let ports = $state<PortEntry[]>([]);
	let portsReady = $state(false);
	let confirming = $state<number | null>(null); // pid awaiting confirmation
	let killing = $state<number | null>(null); // pid currently being killed
	let riskyCount = $derived(ports.filter((p) => p.risk !== 'safe').length);

	// ---- docker ports ----
	let dports = $state<DockerPort[]>([]);
	let dockerReady = $state(false);
	let dockerAvailable = $state(true);
	let dockerReason = $state<string | null>(null);
	let dconfirming = $state<string | null>(null); // container id awaiting confirmation
	let stopping = $state<string | null>(null); // container id currently stopping

	// ---- shared ----
	let error = $state<string | null>(null);
	let autoRefresh = $state(false);
	let updatedAt = $state('');

	const hints: Record<number, string> = {
		3000: 'Next.js · Node',
		3001: 'Node',
		4000: 'Node · Phoenix',
		4200: 'Angular',
		5000: 'Flask · Node',
		5173: 'Vite',
		5174: 'Vite',
		5432: 'PostgreSQL',
		5433: 'PostgreSQL',
		6379: 'Redis',
		8000: 'Django · HTTP',
		8080: 'HTTP · proxy',
		8081: 'HTTP',
		8888: 'Jupyter',
		9000: 'PHP-FPM · MinIO',
		3306: 'MySQL',
		11434: 'Ollama',
		27017: 'MongoDB',
		9200: 'Elasticsearch',
		1433: 'SQL Server'
	};

	function scope(address: string): string {
		if (address === '127.0.0.1' || address === '::1') return 'yalnız localhost';
		if (address === '*' || address === '0.0.0.0' || address === '::') return 'ağa açık';
		return address;
	}

	function stamp() {
		updatedAt = new Date().toLocaleTimeString('tr-TR');
	}

	async function readError(res: Response): Promise<string> {
		try {
			const data = await res.json();
			if (data && typeof data.message === 'string') return data.message;
		} catch {
			/* not JSON */
		}
		return `Beklenmeyen hata (${res.status})`;
	}

	async function loadPorts() {
		try {
			const res = await fetch('/api/ports');
			if (!res.ok) throw new Error(await readError(res));
			ports = (await res.json()).ports;
			error = null;
			stamp();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Portlar okunamadı.';
		} finally {
			portsReady = true;
		}
	}

	async function loadDocker() {
		try {
			const res = await fetch('/api/docker');
			if (!res.ok) throw new Error(await readError(res));
			const data = await res.json();
			dockerAvailable = data.available;
			dockerReason = data.reason ?? null;
			dports = data.ports;
			error = null;
			stamp();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Docker okunamadı.';
		} finally {
			dockerReady = true;
		}
	}

	function refresh() {
		return view === 'tcp' ? loadPorts() : loadDocker();
	}

	function switchView(v: View) {
		if (view === v) return;
		view = v;
		confirming = null;
		dconfirming = null;
		error = null;
		refresh();
	}

	async function kill(pid: number, force = false) {
		killing = pid;
		try {
			const res = await fetch('/api/kill', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ pid, force })
			});
			if (!res.ok) throw new Error(await readError(res));
			confirming = null;
			await loadPorts();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Süreç sonlandırılamadı.';
		} finally {
			killing = null;
		}
	}

	async function stopContainer(id: string) {
		stopping = id;
		try {
			const res = await fetch('/api/docker', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ id })
			});
			if (!res.ok) throw new Error(await readError(res));
			dconfirming = null;
			await loadDocker();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Konteyner durdurulamadı.';
		} finally {
			stopping = null;
		}
	}

	onMount(refresh);

	// Poll the active view while auto-refresh is on.
	$effect(() => {
		if (!autoRefresh) return;
		const id = setInterval(refresh, 3000);
		return () => clearInterval(id);
	});
</script>

<svelte:head>
	<title>portpilot — portlar & docker</title>
</svelte:head>

<main>
	<header>
		<div class="wordmark">
			<span class="dot" aria-hidden="true"></span>
			<h1>portpilot</h1>
		</div>
		<p class="sub">
			Bilgisayarında dinlenen TCP portları ile Docker’ın yayınladığı portlar — aynı yerde.
		</p>

		<div class="tabs" role="tablist" aria-label="Görünüm">
			<button
				role="tab"
				aria-selected={view === 'tcp'}
				class:active={view === 'tcp'}
				onclick={() => switchView('tcp')}
			>
				TCP Portları
			</button>
			<button
				role="tab"
				aria-selected={view === 'docker'}
				class:active={view === 'docker'}
				onclick={() => switchView('docker')}
			>
				Docker Portları
			</button>
		</div>

		<div class="toolbar">
			<div class="count">
				{#if view === 'tcp' && portsReady}
					<strong>{ports.length}</strong> aktif port
					{#if riskyCount > 0}<span class="risky-note"> · {riskyCount} riskli</span>{/if}
				{:else if view === 'docker' && dockerReady && dockerAvailable}
					<strong>{dports.length}</strong> yayınlanan port
				{/if}
				{#if updatedAt}<span class="stamp">· {updatedAt}</span>{/if}
			</div>
			<div class="controls">
				<label class="toggle">
					<input type="checkbox" bind:checked={autoRefresh} />
					Otomatik yenile
				</label>
				<button class="btn" onclick={refresh}>Yenile</button>
			</div>
		</div>
	</header>

	{#if error}
		<div class="banner" role="alert">{error}</div>
	{/if}

	{#if view === 'tcp'}
		{#if !portsReady}
			<div class="table" aria-busy="true" aria-label="Portlar yükleniyor">
				<div class="row row-tcp head" role="row">
					<span>Port</span>
					<span>Süreç</span>
					<span class="num pid">PID</span>
					<span class="col-user">Kullanıcı</span>
					<span></span>
				</div>
				{#each [46, 58, 40, 64, 50, 42, 60, 48] as w (w)}
					<div class="row row-tcp sk-row" aria-hidden="true">
						<span><span class="sk sk-lg" style="width: 44px"></span></span>
						<span><span class="sk" style="width: {w}%"></span></span>
						<span class="num pid"><span class="sk" style="width: 42px"></span></span>
						<span class="col-user"><span class="sk" style="width: 76px"></span></span>
						<span class="action"><span class="sk sk-btn"></span></span>
					</div>
				{/each}
			</div>
		{:else if ports.length === 0}
			<p class="state">Dinlenen TCP portu yok. Her şey sessiz.</p>
		{:else}
			<div class="table" role="table" aria-label="Aktif TCP portları">
				<div class="row row-tcp head" role="row">
					<span role="columnheader">Port</span>
					<span role="columnheader">Süreç</span>
					<span class="num pid" role="columnheader">PID</span>
					<span class="col-user" role="columnheader">Kullanıcı</span>
					<span role="columnheader"></span>
				</div>

				{#each ports as p (p.pid + ':' + p.port)}
					<div class="row row-tcp" role="row" data-risk={p.risk}>
						<span class="port" role="cell">{p.port}</span>

						<span class="proc" role="cell">
							<span class="cmd">{p.command || '—'}</span>
							{#if hints[p.port]}<span class="hint">{hints[p.port]}</span>{/if}
							<span class="addr">{scope(p.address)}</span>
							{#if p.risk !== 'safe'}
								<span class="risk-tag risk-{p.risk}" title={p.riskNote}>
									{p.risk === 'system' ? 'sistem' : 'dikkat'}
								</span>
							{/if}
						</span>

						<span class="num pid" role="cell">{p.pid}</span>
						<span class="col-user user" role="cell">{p.user}</span>

						<span class="action" role="cell">
							{#if confirming === p.pid}
								<button class="btn danger" onclick={() => kill(p.pid)} disabled={killing === p.pid}>
									{killing === p.pid ? 'Kapatılıyor…' : 'Onayla'}
								</button>
								<button class="btn ghost" onclick={() => (confirming = null)} disabled={killing === p.pid}>
									Vazgeç
								</button>
								<button
									class="force"
									onclick={() => kill(p.pid, true)}
									disabled={killing === p.pid}
									title="SIGKILL — anında ve zorla sonlandırır"
								>
									zorla (-9)
								</button>
							{:else}
								<button class="btn kill" onclick={() => (confirming = p.pid)}>Kapat</button>
							{/if}
						</span>
					</div>
				{/each}
			</div>
		{/if}
	{:else if !dockerReady}
		<div class="table" aria-busy="true" aria-label="Docker portları yükleniyor">
			<div class="row row-docker head" role="row">
				<span>Port</span>
				<span>Konteyner</span>
				<span class="num inner">İç Port</span>
				<span></span>
			</div>
			{#each [54, 44, 60, 48, 52] as w (w)}
				<div class="row row-docker sk-row" aria-hidden="true">
					<span><span class="sk sk-lg" style="width: 44px"></span></span>
					<span><span class="sk" style="width: {w}%"></span></span>
					<span class="num inner"><span class="sk" style="width: 62px"></span></span>
					<span class="action"><span class="sk sk-btn"></span></span>
				</div>
			{/each}
		</div>
	{:else if !dockerAvailable}
		<div class="notice">
			<p class="notice-title">Docker kullanılamıyor</p>
			<p class="notice-body">{dockerReason ?? 'Docker’a erişilemedi.'}</p>
			<p class="notice-hint">
				Docker Desktop’ı başlatıp <button class="link" onclick={refresh}>yeniden dene</button>.
			</p>
		</div>
	{:else if dports.length === 0}
		<p class="state">Yayınlanan Docker portu yok. Çalışan konteyner yok ya da port publish edilmemiş.</p>
	{:else}
		<div class="table" role="table" aria-label="Docker portları">
			<div class="row row-docker head" role="row">
				<span role="columnheader">Port</span>
				<span role="columnheader">Konteyner</span>
				<span class="num inner" role="columnheader">İç Port</span>
				<span role="columnheader"></span>
			</div>

			{#each dports as d (d.containerId + ':' + d.hostPort + ':' + d.protocol)}
				<div class="row row-docker" role="row">
					<span class="port" role="cell">{d.hostPort}</span>

					<span class="proc" role="cell">
						<span class="cmd">{d.container}</span>
						<span class="hint">{d.image}</span>
						{#if hints[d.hostPort]}<span class="hint dim">{hints[d.hostPort]}</span>{/if}
						<span class="addr">{scope(d.address)}</span>
					</span>

					<span class="num inner" role="cell">→ {d.containerPort}/{d.protocol}</span>

					<span class="action" role="cell">
						{#if dconfirming === d.containerId}
							<button
								class="btn danger"
								onclick={() => stopContainer(d.containerId)}
								disabled={stopping === d.containerId}
							>
								{stopping === d.containerId ? 'Durduruluyor…' : 'Onayla'}
							</button>
							<button
								class="btn ghost"
								onclick={() => (dconfirming = null)}
								disabled={stopping === d.containerId}
							>
								Vazgeç
							</button>
						{:else}
							<button
								class="btn kill"
								onclick={() => (dconfirming = d.containerId)}
								title="Konteyneri durdurur — bu portu boşaltır"
							>
								Durdur
							</button>
						{/if}
					</span>
				</div>
			{/each}
		</div>
	{/if}

	<footer>
		<span>Yerelde çalışır · <code>lsof</code> + <code>docker</code></span>
		{#if view === 'tcp'}
			<span>Onayla = SIGTERM (nazik) · zorla = SIGKILL (sert)</span>
		{:else}
			<span>Durdur = <code>docker stop</code> · host → konteyner eşlemesi</span>
		{/if}
	</footer>
</main>

<style>
	main {
		max-width: 820px;
		margin: 0 auto;
		padding: clamp(2rem, 6vw, 5rem) 1.25rem 4rem;
	}

	/* ---- header ---- */
	.wordmark {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}
	.dot {
		width: 9px;
		height: 9px;
		border-radius: 50%;
		background: #2fbf71;
		box-shadow: 0 0 0 3px color-mix(in srgb, #2fbf71 22%, transparent);
	}
	h1 {
		margin: 0;
		font-size: 1.6rem;
		font-weight: 640;
		letter-spacing: -0.02em;
	}
	.sub {
		margin: 0.7rem 0 0;
		color: var(--muted);
		max-width: 54ch;
	}

	.tabs {
		display: inline-flex;
		gap: 2px;
		margin-top: 1.5rem;
		padding: 3px;
		border: 1px solid var(--line);
		border-radius: 9px;
		background: var(--surface);
	}
	.tabs button {
		border: none;
		background: none;
		padding: 0.38rem 0.95rem;
		border-radius: 6px;
		color: var(--muted);
		font-size: 0.9rem;
		transition: background 0.15s, color 0.15s;
	}
	.tabs button:hover {
		color: var(--text);
	}
	.tabs button.active {
		background: color-mix(in srgb, var(--text) 8%, transparent);
		color: var(--text);
		font-weight: 540;
	}

	.toolbar {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 1rem;
		margin-top: 1.25rem;
		padding-bottom: 0.85rem;
		border-bottom: 1px solid var(--line-strong);
		flex-wrap: wrap;
	}
	.count {
		color: var(--muted);
		font-size: 0.9rem;
	}
	.count strong {
		color: var(--text);
		font-variant-numeric: tabular-nums;
	}
	.stamp {
		font-family: var(--mono);
		font-size: 0.8rem;
		color: var(--faint);
	}
	.risky-note {
		color: var(--warn);
	}
	.controls {
		display: flex;
		align-items: center;
		gap: 1rem;
	}
	.toggle {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		font-size: 0.9rem;
		color: var(--muted);
		user-select: none;
	}
	.toggle input {
		accent-color: var(--text);
	}

	/* ---- buttons ---- */
	.btn {
		background: var(--surface);
		color: var(--text);
		border: 1px solid var(--line-strong);
		border-radius: 6px;
		padding: 0.4rem 0.85rem;
		font-size: 0.875rem;
		line-height: 1.2;
		transition: border-color 0.15s, background 0.15s, color 0.15s, opacity 0.15s;
	}
	.btn:hover:not(:disabled) {
		border-color: var(--text);
	}
	.btn:disabled {
		opacity: 0.5;
		cursor: default;
	}
	.btn.kill {
		color: var(--muted);
		border-color: var(--line);
	}
	.btn.kill:hover:not(:disabled) {
		color: var(--danger);
		border-color: var(--danger);
	}
	.btn.danger {
		background: var(--danger);
		border-color: var(--danger);
		color: #fff;
	}
	.btn.danger:hover:not(:disabled) {
		background: var(--danger-strong);
		border-color: var(--danger-strong);
	}
	.btn.ghost {
		border-color: var(--line);
		color: var(--muted);
	}
	.force {
		background: none;
		border: none;
		padding: 0.2rem;
		font-size: 0.78rem;
		color: var(--faint);
		text-decoration: underline;
		text-underline-offset: 2px;
	}
	.force:hover:not(:disabled) {
		color: var(--danger);
	}
	.force:disabled {
		opacity: 0.5;
		cursor: default;
	}

	/* ---- table (shared) ---- */
	.table {
		margin-top: 0.25rem;
	}
	.row {
		display: grid;
		align-items: center;
		gap: 1rem;
		padding: 0.85rem 0.25rem;
		border-bottom: 1px solid var(--line);
	}
	.row-tcp {
		grid-template-columns: 74px minmax(0, 1fr) 76px 104px 168px;
	}
	.row-docker {
		grid-template-columns: 74px minmax(0, 1fr) 116px 140px;
	}
	.row.head {
		padding-top: 0.75rem;
		padding-bottom: 0.75rem;
		border-bottom: 1px solid var(--line-strong);
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.09em;
		color: var(--faint);
	}
	.row:not(.head):hover {
		background: color-mix(in srgb, var(--text) 3.5%, transparent);
	}

	.port {
		font-family: var(--mono);
		font-size: 1.05rem;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}
	.num {
		font-family: var(--mono);
		font-variant-numeric: tabular-nums;
		text-align: right;
	}
	.pid {
		color: var(--muted);
		font-size: 0.9rem;
	}
	.inner {
		color: var(--muted);
		font-size: 0.85rem;
	}

	.proc {
		display: flex;
		align-items: baseline;
		gap: 0.55rem;
		min-width: 0;
		flex-wrap: wrap;
	}
	.cmd {
		font-weight: 520;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 100%;
	}
	.hint {
		font-size: 0.78rem;
		color: var(--muted);
	}
	.hint.dim {
		color: var(--faint);
	}
	.addr {
		font-size: 0.76rem;
		color: var(--faint);
		font-family: var(--mono);
	}

	/* risk markers */
	.risk-tag {
		font-size: 0.68rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		font-weight: 600;
		cursor: help;
	}
	.risk-system {
		color: var(--danger);
	}
	.risk-caution {
		color: var(--warn);
	}
	.row[data-risk='system'] {
		box-shadow: inset 2px 0 0 var(--danger);
	}
	.row[data-risk='caution'] {
		box-shadow: inset 2px 0 0 var(--warn);
	}
	.user {
		color: var(--muted);
		font-size: 0.875rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.action {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 0.5rem;
	}

	/* skeleton loading — mirrors the real row layout */
	.sk-row {
		pointer-events: none;
	}
	.sk {
		display: inline-block;
		height: 11px;
		border-radius: 4px;
		vertical-align: middle;
		background: linear-gradient(90deg, var(--sk-base) 25%, var(--sk-hi) 37%, var(--sk-base) 63%);
		background-size: 400% 100%;
		animation: sk-shimmer 1.4s ease infinite;
	}
	.sk-lg {
		height: 15px;
	}
	.sk-btn {
		width: 58px;
		height: 30px;
		border-radius: 6px;
	}
	@keyframes sk-shimmer {
		0% {
			background-position: 100% 50%;
		}
		100% {
			background-position: 0 50%;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.sk {
			animation: none;
		}
	}

	/* ---- misc ---- */
	.banner {
		margin: 1.25rem 0 0;
		padding: 0.7rem 0.9rem;
		border: 1px solid color-mix(in srgb, var(--danger) 45%, var(--line));
		border-radius: 6px;
		color: var(--danger);
		font-size: 0.9rem;
		background: color-mix(in srgb, var(--danger) 7%, transparent);
	}
	.state {
		margin: 3rem 0;
		text-align: center;
		color: var(--muted);
	}
	.notice {
		margin: 2rem 0;
		padding: 1.4rem 1.5rem;
		border: 1px solid var(--line-strong);
		border-radius: 10px;
		background: var(--surface);
		text-align: center;
	}
	.notice-title {
		margin: 0;
		font-weight: 600;
	}
	.notice-body {
		margin: 0.4rem 0 0;
		color: var(--muted);
		font-size: 0.9rem;
	}
	.notice-hint {
		margin: 0.9rem 0 0;
		font-size: 0.85rem;
		color: var(--faint);
	}
	.link {
		background: none;
		border: none;
		padding: 0;
		color: var(--text);
		text-decoration: underline;
		text-underline-offset: 2px;
		font: inherit;
		cursor: pointer;
	}
	footer {
		margin-top: 2.5rem;
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
		font-size: 0.78rem;
		color: var(--faint);
	}
	footer code {
		font-family: var(--mono);
	}

	@media (max-width: 620px) {
		.row-tcp {
			grid-template-columns: 60px minmax(0, 1fr) 132px;
		}
		.row-docker {
			grid-template-columns: 60px minmax(0, 1fr) 116px;
		}
		.col-user,
		.pid,
		.inner {
			display: none;
		}
	}
</style>
