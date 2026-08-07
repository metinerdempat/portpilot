import { describe, it, expect } from 'vitest';
import { splitHighlight, type HighlightPart } from './highlight';

const rejoin = (parts: HighlightPart[]) => parts.map((p) => p.text).join('');

describe('splitHighlight', () => {
	it('returns a single non-hit part when the query is empty', () => {
		expect(splitHighlight('hello world', '')).toEqual([{ text: 'hello world', hit: false }]);
	});

	it('marks a single match', () => {
		expect(splitHighlight('error here', 'error')).toEqual([
			{ text: 'error', hit: true },
			{ text: ' here', hit: false }
		]);
	});

	it('marks multiple matches case-insensitively', () => {
		const parts = splitHighlight('Log log LOG', 'log');
		expect(parts.filter((p) => p.hit).map((p) => p.text)).toEqual(['Log', 'log', 'LOG']);
	});

	it('reconstructs the original line from the parts', () => {
		const line = 'checkpoint: shutdown immediate shutdown';
		expect(rejoin(splitHighlight(line, 'shutdown'))).toBe(line);
	});

	it('returns a single non-hit part when there is no match', () => {
		expect(splitHighlight('abc', 'z')).toEqual([{ text: 'abc', hit: false }]);
	});
});
