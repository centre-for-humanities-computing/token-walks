import seedrandom from 'seedrandom';
import type { Rng } from '../strategies/types.js';

/**
 * Create a seeded PRNG using the Alea algorithm.
 *
 * Uses `seedrandom.alea` (~1.95 ns/call) rather than the default ARC4
 * (~3.8 ns/call). The seed is stringified with a null terminator to
 * prevent ARC4-style key-cycling collisions (e.g. `'1'`, `'11'`, `'111'`
 * would produce identical streams without the terminator).
 *
 * @param seed - An integer seed.
 * @returns A function `() => number` returning values in $[0, 1)$.
 */
export function createRng(seed: number): Rng {
	// seedrandom.alea is a constructor; `new` is optional.
	// The null terminator prevents short-key cycling.
	return seedrandom.alea(String(seed) + '\0');
}

/**
 * Derive the seed for one destination step of a hand walk.
 *
 * A 32-bit avalanche mix of the visible seed and the destination step.
 * No sequence position is mixed in, so Flip and Diffuse at the same
 * destination step deliberately share one random stream: Flip's token is
 * Diffuse's draw for the first unfrozen position.
 *
 * @param seed - The visible seed.
 * @param step - The destination step $t+1$.
 * @returns A 32-bit unsigned integer seed.
 */
export function deriveSeed(seed: number, step: number): number {
	let h = (seed >>> 0) ^ Math.imul((step >>> 0) + 0x9e3779b9, 0x85ebca6b);
	h ^= h >>> 16;
	h = Math.imul(h, 0x7feb352d);
	h ^= h >>> 15;
	h = Math.imul(h, 0x846ca68b);
	h ^= h >>> 16;
	return h >>> 0;
}

/**
 * Generate a random integer seed for UI-initiated re-rolls.
 *
 * Uses `Math.random()` — allowed by CONVENTIONS for trivial UI use.
 * Not suitable for engine-internal seeding.
 *
 * @returns A random 32-bit unsigned integer.
 */
export function randomSeed(): number {
	return (Math.random() * 0xffffffff) >>> 0;
}
