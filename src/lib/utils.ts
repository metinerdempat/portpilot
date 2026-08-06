// Shared, framework-free helpers. Kept out of components and pages.

/** Human label for a bind address — the security-relevant scope of a port. */
export function scopeLabel(address: string): string {
	if (address === '127.0.0.1' || address === '::1') return 'localhost only';
	if (address === '*' || address === '0.0.0.0' || address === '::') return 'exposed';
	return address;
}

/** Pull a human message out of a failed fetch Response. */
export async function readErrorMessage(res: Response): Promise<string> {
	try {
		const data = await res.json();
		if (data && typeof data.message === 'string') return data.message;
	} catch {
		/* body was not JSON */
	}
	return `Unexpected error (${res.status})`;
}

/** Current wall-clock time as a 24-hour string. */
export function formatNow(): string {
	return new Date().toLocaleTimeString('en-GB');
}

/** Compact memory label, e.g. 47 → "47M", 1536 → "1.5G". */
export function formatMem(mb: number): string {
	if (!Number.isFinite(mb)) return '—';
	if (mb >= 1024) return (mb / 1024).toFixed(1) + 'G';
	return Math.round(mb) + 'M';
}
