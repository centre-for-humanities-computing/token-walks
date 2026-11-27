import { describe, it, expect } from 'vitest';
import { isFrozenToken } from './freeze.js';

describe('isFrozenToken', () => {
	it('freezes OOV whitespace and leaves static tokens alone', () => {
		const opts = { vocabSize: 5, oovTokens: ['cat', ' ', '\n'] };
		// Static ids are below 5 - 3 = 2; OOV ids start at 2.
		expect(isFrozenToken(1, opts)).toBe(false);
		expect(isFrozenToken(2, opts)).toBe(false);
		expect(isFrozenToken(3, opts)).toBe(true);
		expect(isFrozenToken(4, opts)).toBe(true);
	});

	it('freezes WordNet-unmapped rows and ignores the OOV rule', () => {
		const rows = Int32Array.from([0, -1, 4]);
		const opts = { vocabSize: 3, oovTokens: [' ', '\n'], wordnetRows: rows };
		expect(isFrozenToken(0, opts)).toBe(false);
		expect(isFrozenToken(1, opts)).toBe(true);
		expect(isFrozenToken(2, opts)).toBe(false);
	});

	it("reads the visible row's token, not the input token", () => {
		const opts = { vocabSize: 4, oovTokens: [' '] };
		// The same position can be frozen at one step and not at another.
		expect(isFrozenToken(3, opts)).toBe(true);
		expect(isFrozenToken(0, opts)).toBe(false);
	});
});
