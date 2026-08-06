import { error } from '@sveltejs/kit';
import { stripAnsi, streamContainerLogs } from '$lib/server/docker';
import type { RequestHandler } from './$types';

/**
 * Server-sent events stream of a container's live logs (`docker logs -f`).
 * Emits `log` events for output and a single `end` event when the process
 * exits (a distinct `error` event name would collide with EventSource's own
 * connection-error event on the client). The child process is killed when the
 * client disconnects (request abort / stream cancel).
 */
export const GET: RequestHandler = ({ url, request }) => {
	const id = url.searchParams.get('id') ?? '';
	const tail = Number(url.searchParams.get('tail') ?? '200');

	const child = streamContainerLogs(id, tail);
	if (!child) throw error(400, 'Invalid container id.');

	const encoder = new TextEncoder();
	const kill = () => {
		try {
			child.kill('SIGKILL');
		} catch {
			// already gone
		}
	};

	const stream = new ReadableStream({
		start(controller) {
			let closed = false;

			const onChunk = (buf: Buffer) => send('log', stripAnsi(buf.toString()));

			const teardown = () => {
				if (closed) return;
				closed = true;
				child.stdout.off('data', onChunk);
				child.stderr.off('data', onChunk);
				kill();
				try {
					controller.close();
				} catch {
					// controller may already be closed by the runtime
				}
			};

			const send = (event: string, data: string) => {
				if (closed) return;
				const body = data
					.split('\n')
					.map((line) => `data: ${line}`)
					.join('\n');
				try {
					controller.enqueue(encoder.encode(`event: ${event}\n${body}\n\n`));
				} catch {
					// client vanished mid-write — stop cleanly instead of crashing
					teardown();
				}
			};

			child.stdout.on('data', onChunk);
			child.stderr.on('data', onChunk);
			child.on('error', () => {
				send('end', 'error');
				teardown();
			});
			child.on('close', () => {
				send('end', 'ended');
				teardown();
			});

			request.signal.addEventListener('abort', teardown);
		},
		cancel() {
			// Runtime-initiated close (client disconnected): just stop the child.
			kill();
		}
	});

	return new Response(stream, {
		headers: {
			'content-type': 'text/event-stream',
			'cache-control': 'no-cache, no-transform',
			connection: 'keep-alive'
		}
	});
};
