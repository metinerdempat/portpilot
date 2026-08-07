// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import StatusBar from './status-bar.svelte';
import { app } from '$lib/stores';

describe('StatusBar', () => {
	it('renders the keyboard hints and the active port source', () => {
		app.portSource = 'ss';
		const { container } = render(StatusBar);
		const text = container.textContent ?? '';
		for (const hint of ['move', 'expand', 'kill', 'filter', 'docker']) {
			expect(text).toContain(hint);
		}
		expect(text).toContain('ss'); // reflects app.portSource, not a hardcoded "lsof"
	});
});
