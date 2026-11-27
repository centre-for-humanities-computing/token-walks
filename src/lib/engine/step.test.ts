import { describe, it, expect } from 'vitest';
import { sampleFlip } from './step.js';
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
	it('samples the token at the requested position with the given beta', () => {
		const { strategy, calls } = makeFixedStrategy();
		const row = Int32Array.from([4, 5, 6]);
		const rng = createRng(42);

		expect(sampleFlip(row, 1, strategy, 0.25, rng)).toBe(7);
		expect(calls).toEqual([{ token: 5, beta: 0.25 }]);
	});

	it('throws for a position outside the row', () => {
		const { strategy } = makeFixedStrategy();
		const row = Int32Array.from([1, 2]);
		expect(() => sampleFlip(row, -1, strategy, 0.1, createRng(1))).toThrow(RangeError);
		expect(() => sampleFlip(row, 2, strategy, 0.1, createRng(1))).toThrow(RangeError);
	});

	it('repeats the same token for the same seed, row and destination step', () => {
		const strategy = getStrategy(
			'lexical',
			{ maxDistance: 2, k: 50, epsilon: 0, tau: 1, family: 'exponential' },
			100,
		);
		const row = Int32Array.from([10, 11, 12]);
		const first = sampleFlip(row, 1, strategy, 0.2, createRng(deriveSeed(42, 3)));
		const second = sampleFlip(row, 1, strategy, 0.2, createRng(deriveSeed(42, 3)));

		expect(first).toBe(second);
		expect(first).toBeGreaterThanOrEqual(0);
		expect(first).toBeLessThan(100);
	});
});
