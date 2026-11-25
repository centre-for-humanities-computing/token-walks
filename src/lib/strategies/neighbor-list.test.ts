import { describe, it, expect } from 'vitest';
import { buildNeighborListPage, NEIGHBOR_LIST_PAGE_SIZE } from './neighbor-list.js';
import { EditDistanceModel } from './distance-model.js';
import { NeighborhoodProvider } from './neighborhood.js';
import type { NeighborEntry } from './neighborhood.js';

/** Provider stub: a fixed distance-sorted list and a store cap. */
function fakeProvider(entries: readonly NeighborEntry[], maxStored: number) {
	return {
		maxStored,
		neighborsOf: () => entries,
	} satisfies Pick<NeighborhoodProvider, 'neighborsOf' | 'maxStored'>;
}

const labelOf = (id: number): string => `t${id}`;

describe('buildNeighborListPage', () => {
	const stored: NeighborEntry[] = Array.from({ length: 30 }, (_, i) => ({ id: i + 100, dist: i }));
	const provider = fakeProvider(stored, 200);

	it('keeps provider order, labels each row and shows raw distance', () => {
		const { entries } = buildNeighborListPage(provider, 0, 0, 5, labelOf);
		expect(entries).toEqual(stored.slice(0, 5).map((e) => ({ ...e, label: `t${e.id}` })));
	});

	it('pages with no gaps or duplicates and a short last page', () => {
		const pages = [0, 25].map((offset) =>
			buildNeighborListPage(provider, 0, offset, NEIGHBOR_LIST_PAGE_SIZE, labelOf),
		);
		expect(pages.map((p) => p.entries.length)).toEqual([25, 5]);
		expect(pages.flatMap((p) => p.entries.map((e) => e.id))).toEqual(stored.map((e) => e.id));
		expect(pages[0]!.total).toBe(30);
	});

	it('keeps total independent of the window and empty past the end', () => {
		const page = buildNeighborListPage(provider, 0, 999, NEIGHBOR_LIST_PAGE_SIZE, labelOf);
		expect(page).toMatchObject({ entries: [], total: 30, hasNeighborhood: true });
	});

	it('sets atCap only when the stored list fills the provider cap', () => {
		expect(buildNeighborListPage(provider, 0, 0, 5, labelOf).atCap).toBe(false);
		expect(buildNeighborListPage(fakeProvider(stored, 30), 0, 0, 5, labelOf).atCap).toBe(true);
	});

	it('reports no neighbourhood without a provider', () => {
		expect(buildNeighborListPage(null, 0, 0, NEIGHBOR_LIST_PAGE_SIZE, labelOf)).toMatchObject({
			entries: [],
			hasNeighborhood: false,
		});
	});

	it('keeps a provider-backed empty list distinct from no provider', () => {
		const empty = fakeProvider([], 200);
		expect(buildNeighborListPage(empty, 0, 0, NEIGHBOR_LIST_PAGE_SIZE, labelOf)).toMatchObject({
			entries: [],
			total: 0,
			hasNeighborhood: true,
		});
	});
});

describe('buildNeighborListPage on the lexical provider', () => {
	const vocab = ['cat', 'cats', 'car', 'cart', 'dog', 'dogs', 'frog', 'log'];
	const provider = new NeighborhoodProvider(new EditDistanceModel(vocab), 2, { maxStored: 200 });
	const labelOf = (id: number): string => vocab[id]!;

	it('pages the real provider list with no gaps and resolved labels', () => {
		const stored = provider.neighborsOf(0);
		expect(stored.length).toBeGreaterThan(2);
		const seen: number[] = [];
		for (let offset = 0; offset < stored.length; offset += 2) {
			const page = buildNeighborListPage(provider, 0, offset, 2, labelOf);
			expect(page.total).toBe(stored.length);
			expect(page.entries.every((e) => e.label.length > 0)).toBe(true);
			seen.push(...page.entries.map((e) => e.id));
		}
		expect(seen).toEqual(stored.map((e) => e.id));
	});
});
