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

	const oov = oovTokens ?? [];
	const staticK = vocabSize - oov.length;
	if (oov.length === 0 || tokenId < staticK) return false;
	const text = oov[tokenId - staticK];
	return text === ' ' || text === '\n';
}
