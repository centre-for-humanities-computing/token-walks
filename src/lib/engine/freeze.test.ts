import { describe, it, expect } from 'vitest';
import { frozenMaskFor, isFrozenToken, wordnetFrozenMask } from './freeze.js';

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
});

describe('frozenMaskFor', () => {
	it('marks only OOV whitespace positions and returns undefined when none', () => {
		const oov = ['cat', ' ', '\n'];
		const row = Int32Array.from([1, 2, 3, 4, 2]);
		// vocabSize 5, three OOVs -> static K 2; OOV ids 2,3,4.
		expect(Array.from(frozenMaskFor(row, 5, oov)!)).toEqual([0, 0, 1, 1, 0]);
		expect(frozenMaskFor(row, 5, ['cat'])).toBeUndefined();
		expect(frozenMaskFor(row, 5)).toBeUndefined();
	});
});

describe('wordnetFrozenMask', () => {
	it('marks rows with no outbound target and returns undefined when all map', () => {
		const rows = Int32Array.from([0, -1, 3, -1]);
		expect(Array.from(wordnetFrozenMask(Int32Array.from([0, 1, 2]), rows)!)).toEqual([0, 1, 0]);
		expect(wordnetFrozenMask(Int32Array.from([0, 2]), rows)).toBeUndefined();
	});
});
