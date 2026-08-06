/** The port/process views. */
export type View = 'tcp' | 'docker';

/** Every selectable tab, including the containers view. */
export type Tab = View | 'containers';

/** Lazily-loaded detail (process stats, container stats, or logs) for a row. */
export type Detail = {
	loading: boolean;
	error: string | null;
	data: Record<string, string | number | null> | null;
};
