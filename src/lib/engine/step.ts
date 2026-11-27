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

/**
 * Build the next hand-walk row by sampling every unfrozen position.
 * Walks positions $i = 0 \ldots L-1$ in order and draws exactly once per
 * unfrozen position; frozen positions copy their current token without
 * consuming a draw.
 */
export function sampleDiffuse(
	row: Int32Array,
	strategy: NoiseStrategy,
	beta: number,
	rng: Rng,
	frozen?: Uint8Array,
): Int32Array {
	const next = new Int32Array(row.length);
	for (let i = 0; i < row.length; i++) {
		const token = row[i]!;
		next[i] = frozen?.[i] === 1 ? token : strategy.sampleStep(token, beta, rng);
	}
	return next;
}
