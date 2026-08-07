import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { svelteTesting } from '@testing-library/svelte/vite';
import { fileURLToPath } from 'node:url';

// Pure-logic tests run under the default `node` environment; component tests
// opt into jsdom with a `// @vitest-environment jsdom` docblock. The svelte
// plugin compiles .svelte / .svelte.ts imports; svelteTesting wires up
// auto-cleanup between component tests.
export default defineConfig({
	plugins: [svelte(), svelteTesting()],
	test: {
		environment: 'node',
		include: ['src/**/*.test.ts'],
		setupFiles: ['./vitest.setup.ts']
	},
	resolve: {
		alias: {
			$lib: fileURLToPath(new URL('./src/lib', import.meta.url))
		}
	}
});
