/**
 * Hand-walk freeze rule for one position's current token. It reads the
 * visible row, not $x_0$: OOV whitespace is frozen, and WordNet rows
 * freeze a token with no outbound target. The rules are exclusive,
 * matching the full engine's mask choice.
 */
export function isFrozenToken(
	tokenId: number,
	opts: {
		vocabSize: number;
		oovTokens?: readonly string[];
		wordnetRows?: Int32Array;
	},
): boolean {
	const { vocabSize, oovTokens, wordnetRows } = opts;

	if (wordnetRows) {
		const row = wordnetRows[tokenId];
		return row === undefined || row < 0;
	}

	const whitespace = whitespaceIds(vocabSize - (oovTokens?.length ?? 0), oovTokens ?? []);
	return whitespace.has(tokenId);
}

/** Ids of the OOV whitespace tokens, offset by the static vocabulary. */
export function whitespaceIds(staticK: number, oovTokens: readonly string[]): Set<number> {
	const ids = new Set<number>();
	for (let i = 0; i < oovTokens.length; i++) {
		const token = oovTokens[i]!;
		if (token === ' ' || token === '\n') ids.add(staticK + i);
	}
	return ids;
}

/**
 * Freeze mask for positions whose current id is an OOV whitespace token.
 *
 * $K_{\text{eff}} = K + |\text{OOV}|$, so the OOV id of entry $i$ is
 * `vocabSize - oovTokens.length + i`. Returns `undefined` when there are
 * no whitespace OOV positions.
 */
export function frozenMaskFor(
	inputIds: Int32Array,
	vocabSize: number,
	oovTokens?: readonly string[],
): Uint8Array | undefined {
	const oov = oovTokens ?? [];
	if (oov.length === 0) return undefined;
	const whitespace = whitespaceIds(vocabSize - oov.length, oov);
	const mask = new Uint8Array(inputIds.length);
	let any = false;
	for (let i = 0; i < inputIds.length; i++) {
		if (whitespace.has(inputIds[i]!)) {
			mask[i] = 1;
			any = true;
		}
	}
	return any ? mask : undefined;
}

/** Freeze every position whose token has no outbound WordNet target. */
export function wordnetFrozenMask(inputIds: Int32Array, rows: Int32Array): Uint8Array | undefined {
	const mask = new Uint8Array(inputIds.length);
	let any = false;
	for (let i = 0; i < inputIds.length; i++) {
		const row = rows[inputIds[i]!];
		if (row === undefined || row < 0) {
			mask[i] = 1;
			any = true;
		}
	}
	return any ? mask : undefined;
}
