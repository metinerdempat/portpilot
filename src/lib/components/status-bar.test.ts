// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import StatusBar from './status-bar.svelte';

describe('StatusBar', () => {
	it('renders the keyboard hints and the data sources', () => {
		const { container } = render(StatusBar);
		const text = container.textContent ?? '';
		for (const hint of ['move', 'expand', 'kill', 'filter', 'lsof', 'docker']) {
			expect(text).toContain(hint);
		}
	});
});
