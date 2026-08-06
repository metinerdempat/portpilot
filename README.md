# portpilot

A clean local dashboard for seeing which TCP ports are in use on your machine — and killing the process behind any of them in one click. No more `Error: listen EADDRINUSE :::3000`.

It has two switchable views — **TCP ports** (everything listening on your machine) and **Docker ports** (what your running containers publish) — shown side by side in the same clean layout.

Built as a single [SvelteKit](https://kit.svelte.dev) app: the browser renders the UI, while SvelteKit's server endpoints run `lsof` / `docker` and send the kill signal. One codebase, full-stack.

## Why

Every developer hits this: a dev server crashes but keeps the port, or you forget what's already running on `3000`. The usual fix is a half-remembered `lsof -ti:3000 | xargs kill -9`. portpilot turns that into a readable list you can act on.

## Features

- **Two views, one switch** — flip between the machine's **TCP ports** and **Docker's published ports**, rendered identically.
- **Dense, monitor-style list** — port, process, live **CPU %**, memory, PID and bind scope (`localhost` vs. exposed to the network), with tabular monospace numerals.
- **Filter and drive it from the keyboard** — `/` to filter as you type, `↑↓` / `j` `k` to move, `↵` to expand, `x` to kill.
- **Expand any row** for live technical details — a TCP process shows CPU %, resident memory, uptime, parent PID and its full command line; a container shows CPU, memory, network and disk I/O, and process count. Fetched on demand when you open the row.
- **Docker port map** — every running container's `host → container` port mapping, with image and scope; **copy** the `localhost:port` or **restart** the owner right from the row.
- **Containers view** — a third tab listing every container (running + stopped), grouped by Compose project, with image, status + health + age and published ports. **Start / stop / restart** each one, and expand a row to peek at its **logs**.
- **Stop a container** — free a Docker-held port straight from the list with `docker stop` (graceful), behind the same confirm step.
- **Risk warnings** — flags processes that are dangerous to kill with a `system` / `caution` marker, an accent bar and a header count. Known system daemons (`ControlCenter`, `rapportd`, …) are **protected**: the kill action is replaced by a lock so you can't take them down by accident. Privileged ports (below 1024) and root- or other-user-owned processes are marked `caution`.
- **One-click kill** with an inline confirm step, so nothing dies by accident.
- **Graceful by default** — the confirm button sends `SIGTERM`; a separate `force` action sends `SIGKILL` only when you mean it.
- **Tooltips** on every action, **auto-refresh** toggle, graceful "Docker not running" handling, light & dark, keyboard-focusable, no external UI dependencies.

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
pnpm install
pnpm dev
```

Then open http://localhost:5173.

For a production build:

```bash
pnpm build
pnpm start        # node build
```

## Platform support

- **macOS / Linux** — ports via `lsof`, process stats via `ps`.
- **Windows** — ports via `netstat -ano`, process names + memory via `tasklist`; killing works through Node's `process.kill` (mapped to `TerminateProcess`). CPU %, full command line and user aren't surfaced there yet.

Docker works the same everywhere (it shells out to the `docker` CLI). The right implementation is chosen at runtime from `process.platform`.

## Safety

portpilot only ever *reads* the port table and *sends signals to processes you already have permission to kill*. It refuses `pid ≤ 1`, and if the OS denies a kill (a process owned by another user) it tells you so instead of failing silently. It binds to `localhost`; don't expose the dev server to your network.

## Tech

SvelteKit · Svelte 5 (runes) · TypeScript · `adapter-node` · pnpm · [lucide](https://lucide.dev) icons.

Shared code lives outside the components in barrelled folders: `type`s in `src/lib/types/`, constants in `src/lib/constants/`, framework-free helpers in `src/lib/utils/`, reusable UI in `src/lib/components/`, and the OS-facing logic (with a per-platform split) in `src/lib/server/`. Every function is an arrow.

## License

MIT
