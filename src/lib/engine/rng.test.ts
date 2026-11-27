import { describe, it, expect } from 'vitest';
import { createRng, deriveSeed, randomSeed } from './rng.js';

describe('createRng', () => {
	it('returns a function', () => {
		const rng = createRng(42);
		expect(typeof rng).toBe('function');
	});

	it('produces values in [0, 1)', () => {
		const rng = createRng(42);
		for (let i = 0; i < 1000; i++) {
			const v = rng();
			expect(v).toBeGreaterThanOrEqual(0);
			expect(v).toBeLessThan(1);
		}
	});

	it('is deterministic for the same seed', () => {
		const a = createRng(12345);
		const b = createRng(12345);
		for (let i = 0; i < 100; i++) {
			expect(a()).toBe(b());
		}
	});

	it('produces different streams for different seeds', () => {
		const a = createRng(1);
		const b = createRng(2);
		let same = 0;
		for (let i = 0; i < 100; i++) {
			if (a() === b()) same++;
		}
		// With 100 draws, probability of all matching is ~0.
		expect(same).toBeLessThan(100);
	});
});

describe('deriveSeed', () => {
	it('is deterministic and returns a 32-bit unsigned integer', () => {
		for (let step = 0; step < 50; step++) {
			const a = deriveSeed(42, step);
			expect(a).toBe(deriveSeed(42, step));
			expect(Number.isInteger(a)).toBe(true);
			expect(a).toBeGreaterThanOrEqual(0);
			expect(a).toBeLessThanOrEqual(0xffffffff);
		}
	});

	it('mixes the destination step into the stream', () => {
		const seeds = new Set<number>();
		for (let step = 0; step < 50; step++) seeds.add(deriveSeed(42, step));
		expect(seeds.size).toBeGreaterThan(1);
		expect(deriveSeed(42, 1)).not.toBe(deriveSeed(42, 2));
		expect(deriveSeed(42, 1)).not.toBe(deriveSeed(43, 1));
	});
});

describe('randomSeed', () => {
	it('returns a non-negative integer', () => {
		for (let i = 0; i < 100; i++) {
			const s = randomSeed();
			expect(Number.isInteger(s)).toBe(true);
			expect(s).toBeGreaterThanOrEqual(0);
			expect(s).toBeLessThanOrEqual(0xffffffff);
		}
	});

	it('produces varied values', () => {
		const seeds = new Set<number>();
		for (let i = 0; i < 50; i++) {
			seeds.add(randomSeed());
		}
		// Extremely unlikely to get only 1 unique value in 50 draws.
		expect(seeds.size).toBeGreaterThan(1);
	});
});
