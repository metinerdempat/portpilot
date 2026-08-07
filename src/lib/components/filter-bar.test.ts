// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import FilterBar from './filter-bar.svelte';
import { app } from '$lib/stores';

describe('FilterBar', () => {
	beforeEach(() => {
		app.filter = '';
	});

	it('writes what the user types into the store filter', async () => {
		render(FilterBar);
		const input = screen.getByRole('textbox', { name: 'Filter' });
		await fireEvent.input(input, { target: { value: 'postgres' } });
		expect(app.filter).toBe('postgres');
	});

	it('shows a clear button while filtered and empties the filter on click', async () => {
		app.filter = 'redis';
		render(FilterBar);
		expect(screen.getByDisplayValue('redis')).toBeInTheDocument();
		await fireEvent.click(screen.getByRole('button', { name: 'Clear filter' }));
		expect(app.filter).toBe('');
	});
});
