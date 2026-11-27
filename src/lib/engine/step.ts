import type { NoiseStrategy, Rng } from '../strategies/types.js';

/**
 * Force one next token for a single position of a hand-walk row.
 * Pure wrapper around the strategy's coupled `sampleStep`, testable
 * without a message boundary. A flip is a forced jump: the strategy sees
 * $\beta = 1$, so the active kernel's jump row decides the token and the
 * stay coin cannot leave the position unchanged.
 *
 * @throws If `position` is outside the row.
 */
export function sampleFlip(
	row: Int32Array,
	position: number,
	strategy: NoiseStrategy,
	rng: Rng,
): number {
	const token = row[position];
	if (token === undefined) {
		throw new RangeError(`Position ${position} is outside a row of length ${row.length}.`);
	}
	return strategy.sampleStep(token, 1, rng);
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
