import { describe, it, expect } from 'vitest';
import { sampleDiffuse, sampleFlip } from './step.js';
import { createRng, deriveSeed } from './rng.js';
import { getStrategy } from '../strategies/index.js';
import type { NoiseStrategy } from '../strategies/types.js';

/** A fake strategy that returns a known token and records the call. */
function makeFixedStrategy(): {
	strategy: NoiseStrategy;
	calls: Array<{ token: number; beta: number }>;
} {
	const calls: Array<{ token: number; beta: number }> = [];
	const strategy = {
		info: {
			id: 'fixed',
			label: '',
			description: '',
			stationary: 'point-mass' as const,
			plainName: '',
			gloss: '',
			tooltip: { text: '' },
		},
		config: {},
		sampleStep(token: number, beta: number): number {
			calls.push({ token, beta });
			return 7;
		},
	};
	return { strategy, calls };
}

describe('sampleFlip', () => {
	it('forces the jump by passing beta 1 at the requested position', () => {
		const { strategy, calls } = makeFixedStrategy();
		const row = Int32Array.from([4, 5, 6]);

		expect(sampleFlip(row, 1, strategy, createRng(42))).toBe(7);
		expect(calls).toEqual([{ token: 5, beta: 1 }]);
	});

	it('throws for a position outside the row', () => {
		const { strategy } = makeFixedStrategy();
		const row = Int32Array.from([1, 2]);
		expect(() => sampleFlip(row, -1, strategy, createRng(1))).toThrow(RangeError);
		expect(() => sampleFlip(row, 2, strategy, createRng(1))).toThrow(RangeError);
	});

	it('repeats the same token for the same seed, row and destination step', () => {
		const strategy = getStrategy(
			'lexical',
			{ maxDistance: 2, k: 50, epsilon: 0, tau: 1, family: 'exponential' },
			100,
		);
		const row = Int32Array.from([10, 11, 12]);
		const first = sampleFlip(row, 1, strategy, createRng(deriveSeed(42, 3)));
		const second = sampleFlip(row, 1, strategy, createRng(deriveSeed(42, 3)));

		expect(first).toBe(second);
		expect(first).toBeGreaterThanOrEqual(0);
		expect(first).toBeLessThan(100);
	});
});

describe('sampleDiffuse', () => {
	it('draws once per unfrozen position in row order and copies frozen cells', () => {
		const calls: number[] = [];
		const strategy: NoiseStrategy = {
			info: {
				id: 'plus-ten',
				label: '',
				description: '',
				stationary: 'point-mass',
				plainName: '',
				gloss: '',
				tooltip: { text: '' },
			},
			config: {},
			sampleStep(token: number, beta: number): number {
				calls.push(beta);
				return token + 10;
			},
		};
		const row = Int32Array.from([4, 5, 6]);
		const frozen = Uint8Array.from([0, 1, 0]);

		const next = sampleDiffuse(row, strategy, 0.3, createRng(7), frozen);

		expect(Array.from(next)).toEqual([14, 5, 16]);
		expect(calls).toEqual([0.3, 0.3]);
	});

	it('matches a naive per-position loop for random rows and freeze masks', () => {
		const strategy = getStrategy(
			'lexical',
			{ maxDistance: 2, k: 50, epsilon: 0, tau: 1, family: 'exponential' },
			100,
		);
		const L = 6;

		for (let seed = 0; seed < 40; seed++) {
			const rowRng = createRng(seed);
			const row = Int32Array.from({ length: L }, () => Math.floor(rowRng() * 100));
			const frozen = Uint8Array.from({ length: L }, () => (rowRng() < 0.3 ? 1 : 0));
			const step = 11;
			const actual = sampleDiffuse(row, strategy, 0.4, createRng(deriveSeed(seed, step)), frozen);

			// Naive reference: one fresh stream, one draw per unfrozen index.
			const refRng = createRng(deriveSeed(seed, step));
			const expected = new Int32Array(L);
			for (let i = 0; i < L; i++) {
				expected[i] = frozen[i] === 1 ? row[i]! : strategy.sampleStep(row[i]!, 0.4, refRng);
			}
			expect(Array.from(actual)).toEqual(Array.from(expected));
		}
	});
});
