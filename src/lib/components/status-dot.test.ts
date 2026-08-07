// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import type { ComponentProps } from 'svelte';
import { render } from '@testing-library/svelte';
import StatusDot from './status-dot.svelte';

const dotClass = (props: ComponentProps<typeof StatusDot>) => {
	const { container } = render(StatusDot, { props });
	return container.querySelector('span')?.className ?? '';
};

describe('StatusDot', () => {
	it('is green (ok) by default', () => {
		expect(dotClass({})).toContain('bg-ok');
	});

	it('maps risk to a colour', () => {
		expect(dotClass({ risk: 'system' })).toContain('bg-danger');
		expect(dotClass({ risk: 'caution' })).toContain('bg-warn');
		expect(dotClass({ risk: 'running' })).toContain('bg-ok');
	});

	it('maps container state to a colour', () => {
		expect(dotClass({ state: 'bad' })).toContain('bg-danger');
		expect(dotClass({ state: 'warn' })).toContain('bg-warn');
		expect(dotClass({ state: 'off' })).toContain('bg-faint');
		expect(dotClass({ state: 'ok' })).toContain('bg-ok');
	});

	it('uses the skeleton shimmer colour when skeleton', () => {
		expect(dotClass({ skeleton: true })).toContain('bg-sk-hi');
	});

	it('sets the title attribute for the risk note', () => {
		const { container } = render(StatusDot, { props: { risk: 'system', title: 'protected process' } });
		expect(container.querySelector('span')).toHaveAttribute('title', 'protected process');
	});
});
