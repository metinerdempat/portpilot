import type { Handle } from '@sveltejs/kit';
import { text } from '@sveltejs/kit';

/**
 * portpilot controls local processes and Docker with **no authentication**, so
 * it must only ever answer requests addressed to a loopback host. Rejecting any
 * other Host header blocks two things a CORS/origin check alone wouldn't:
 *   - a LAN peer, if the server happens to be bound to 0.0.0.0
 *   - a DNS-rebinding website that points its domain at 127.0.0.1
 */
export const isLoopbackHost = (host: string | null): boolean => {
	if (!host) return false;
	const name = host
		.replace(/:\d+$/, '') // strip :port
		.replace(/^\[|\]$/g, '') // strip IPv6 brackets
		.toLowerCase();
	return name === 'localhost' || name === '::1' || /^127\.\d+\.\d+\.\d+$/.test(name);
};

export const handle: Handle = async ({ event, resolve }) => {
	if (!isLoopbackHost(event.request.headers.get('host'))) {
		return text('portpilot is a local-only tool — reachable only via localhost.', { status: 403 });
	}
	return resolve(event);
};
