/** Current wall-clock time as a 24-hour string. */
export const formatNow = (): string => new Date().toLocaleTimeString('en-GB');

/** Compact memory label, e.g. 47 → "47M", 1536 → "1.5G". */
export const formatMem = (mb: number): string => {
	if (!Number.isFinite(mb)) return '—';
	if (mb >= 1024) return (mb / 1024).toFixed(1) + 'G';
	return Math.round(mb) + 'M';
};
