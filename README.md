# portpilot

A clean local dashboard for seeing which TCP ports are in use on your machine — and killing the process behind any of them in one click. No more `Error: listen EADDRINUSE :::3000`.

It has two switchable views — **TCP ports** (everything listening on your machine) and **Docker ports** (what your running containers publish) — shown side by side in the same clean layout.

Built as a single [SvelteKit](https://kit.svelte.dev) app: the browser renders the UI, while SvelteKit's server endpoints run `lsof` / `docker` and send the kill signal. One codebase, full-stack.

## Why

Every developer hits this: a dev server crashes but keeps the port, or you forget what's already running on `3000`. The usual fix is a half-remembered `lsof -ti:3000 | xargs kill -9`. portpilot turns that into a readable list you can act on.

## Features

- **Two views, one switch** — flip between the machine's **TCP ports** and **Docker's published ports**, rendered identically.
- **Live list of listening ports** — port, process, PID, user and bind scope (`localhost` vs. exposed to the network).
- **Expand any row** for live technical details — a TCP process shows CPU %, resident memory, uptime, parent PID and its full command line; a container shows CPU, memory, network and disk I/O, and process count. Fetched on demand when you open the row.
- **Docker port map** — every running container's `host → container` port mapping, with image and scope.
- **Stop a container** — free a Docker-held port straight from the list with `docker stop` (graceful), behind the same confirm step.
- **Risk warnings** — flags processes that are dangerous to kill (system daemons like `ControlCenter` / `rapportd`, privileged ports below 1024, root- or other-user-owned) with a `system` / `dikkat` marker and a header count, so you don't take down something important by mistake.
- **One-click kill** with an inline confirm step, so nothing dies by accident.
- **Graceful by default** — the confirm button sends `SIGTERM`; a separate `force (-9)` action sends `SIGKILL` only when you mean it.
- **Friendly hints** — recognises common ports (`3000 → Next.js`, `5432 → PostgreSQL`, `6379 → Redis`, …).
- **Auto-refresh** toggle, graceful "Docker not running" handling, light & dark, keyboard-focusable, no external UI dependencies.

## How it works

```
Browser (Svelte UI)  ──fetch──▶  SvelteKit server endpoints  ──▶  OS
   +page.svelte                   /api/ports         → lsof
                                  /api/kill          → process.kill(pid, signal)
                                  /api/docker        → docker ps / docker stop
                                  /api/process       → ps  (per-process details)
                                  /api/docker/stats  → docker stats
```

Listing ports comes down to reading the kernel's open-file table via `lsof`:

```bash
lsof -nP +c0 -iTCP -sTCP:LISTEN -FpcnL
```

- `-nP` — numeric addresses and ports (no slow DNS / service-name lookups)
- `-iTCP -sTCP:LISTEN` — only TCP sockets in the `LISTEN` state
- `-FpcnL` — machine-readable output (pid, command, name, login)

Killing a port is really killing the process that holds it. `SIGTERM` asks it to shut down cleanly and release the port; `SIGKILL` (`-9`) forces the kernel to remove it immediately, with no cleanup — a last resort. The server uses Node's `process.kill(pid, signal)` directly, so there is no shell string to inject into.

The Docker view reads `docker ps --format '{{json .}}'` and parses each container's published mappings (`0.0.0.0:5432->5432/tcp`) into the same shape as a TCP port, so both lists render through one component. Stopping a container runs `docker stop` (SIGTERM, then SIGKILL after a grace period). Commands are run via `execFile` (no shell), and container ids are validated before use.

Each TCP listener is also given a **risk rating** on the server: known system daemons, ports below 1024, and processes owned by `root` or another user are marked `system` / `dikkat` so the kill action carries a visible warning instead of treating every process as equally safe.

## Run it

```bash
npm install
npm run dev
```

Then open http://localhost:5173.

For a production build:

```bash
npm run build
npm start        # node build
```

## Platform support

Works on **macOS** and **Linux**, both of which ship `lsof`. Windows is not supported yet — the equivalent there is `netstat -ano` + `taskkill`, which would slot in behind the same API.

## Safety

portpilot only ever *reads* the port table and *sends signals to processes you already have permission to kill*. It refuses `pid ≤ 1`, and if the OS denies a kill (a process owned by another user) it tells you so instead of failing silently. It binds to `localhost`; don't expose the dev server to your network.

## Tech

SvelteKit · Svelte 5 (runes) · TypeScript · `adapter-node` · zero runtime UI dependencies.

## License

MIT
