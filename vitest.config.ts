import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// Standalone Vitest config — no SvelteKit plugin needed for the pure-logic unit
// tests, just the `$lib` alias so imports resolve the same way as in the app.
export default defineConfig({
	test: {
		environment: 'node',
		include: ['src/**/*.test.ts']
	},
	resolve: {
		alias: {
			$lib: fileURLToPath(new URL('./src/lib', import.meta.url))
		}
	}
});
