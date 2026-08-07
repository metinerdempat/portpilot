import { z } from 'zod';

const pid = z
	.coerce.number({ error: 'A valid PID is required.' })
	.int('A valid PID is required.')
	.positive('A valid PID is required.');

/** `?pid=` query for the process-info endpoint. */
export const pidQuery = z.object({ pid });

/** POST body for the kill endpoint. */
export const killBody = z.object({ pid, force: z.boolean().default(false) });
