import { z } from 'zod';
import { CONTAINER_ID_RE } from '$lib/constants';

// Treat a missing id (undefined / null) as empty so it reports "required"
// rather than a raw type error, whether it came from a query param or a body.
const containerId = z.preprocess(
	(v) => v ?? '',
	z.string().min(1, 'Container id is required.').regex(CONTAINER_ID_RE, 'Invalid container id.')
);

/** `?id=` query for the stats / inspect endpoints. */
export const containerIdQuery = z.object({ id: containerId });

/** POST body for start / stop / restart. Defaults to `stop` so the ports view,
 *  which sends only `{ id }`, keeps working. */
export const dockerActionBody = z.object({
	id: containerId,
	action: z.enum(['start', 'stop', 'restart']).default('stop')
});

/** `?id=&tail=` query for the live log stream; an out-of-range tail falls back to 200. */
export const logStreamQuery = z.object({
	id: containerId,
	tail: z.coerce.number().int().min(1).max(2000).catch(200)
});
