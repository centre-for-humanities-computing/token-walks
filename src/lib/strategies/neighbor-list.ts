/**
 * Page the stored neighbourhood of one token for the inspector's list.
 *
 * Reads `provider.neighborsOf(token)` directly — the provider's distance
 * order, not `resolveNeighbors` — and shows raw distance, never a softmax
 * weight: weights are only meaningful within the strategy's top-$k$.
 *
 * Pure function over a provider-shaped object: no worker, no DOM.
 */

import type { NeighborhoodProvider } from './neighborhood.js';
import type { NeighborListPage } from '../workers/trajectory.protocol.js';

/** Rows per page in the inspector's neighbourhood list. */
export const NEIGHBOR_LIST_PAGE_SIZE = 25;

/**
 * Return one `offset`/`limit` window of the token's stored list, nearest
 * first. `total` is the full stored length; `atCap` is true when the
 * provider returned exactly its `maxStored` cap (so the list cannot see
 * past it); `hasNeighborhood` is false without a provider.
 */
export function buildNeighborListPage(
	provider: Pick<NeighborhoodProvider, 'neighborsOf' | 'maxStored'> | null,
	tokenId: number,
	offset: number,
	limit: number,
	labelOf: (id: number) => string,
): NeighborListPage {
	if (!provider) {
		return { entries: [], total: 0, atCap: false, hasNeighborhood: false };
	}

	const stored = provider.neighborsOf(tokenId);
	return {
		entries: stored.slice(offset, offset + limit).map((e) => ({
			id: e.id,
			label: labelOf(e.id),
			dist: e.dist,
		})),
		total: stored.length,
		atCap: stored.length === provider.maxStored,
		hasNeighborhood: true,
	};
}
