export type HighlightPart = { text: string; hit: boolean };

/**
 * Split a line into alternating plain / matched parts for a case-insensitive
 * substring query, so a log line can render its matches highlighted.
 */
export const splitHighlight = (line: string, query: string): HighlightPart[] => {
	const q = query.toLowerCase();
	if (!q) return [{ text: line, hit: false }];

	const parts: HighlightPart[] = [];
	const lower = line.toLowerCase();
	let i = 0;
	while (i < line.length) {
		const at = lower.indexOf(q, i);
		if (at === -1) {
			parts.push({ text: line.slice(i), hit: false });
			break;
		}
		if (at > i) parts.push({ text: line.slice(i, at), hit: false });
		parts.push({ text: line.slice(at, at + q.length), hit: true });
		i = at + q.length;
	}
	return parts;
};
