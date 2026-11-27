import type { NoiseStrategy, Rng } from '../strategies/types.js';

/**
 * Sample one next token for a single position of a hand-walk row.
 * Pure wrapper around the strategy's coupled `sampleStep`, testable
 * without a message boundary.
 *
 * @throws If `position` is outside the row.
 */
export function sampleFlip(
	row: Int32Array,
	position: number,
	strategy: NoiseStrategy,
	beta: number,
	rng: Rng,
): number {
	const token = row[position];
	if (token === undefined) {
		throw new RangeError(`Position ${position} is outside a row of length ${row.length}.`);
	}
	return strategy.sampleStep(token, beta, rng);
}
