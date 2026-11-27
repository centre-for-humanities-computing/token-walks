import { describe, it, expect } from 'vitest';
import seedrandom from 'seedrandom';
import { HandWalk } from './hand-walk.js';

const initial = () => Int32Array.from([1, 2, 3]);

describe('HandWalk', () => {
	it('opens with one row and no future', () => {
		const walk = new HandWalk(initial(), 10);
		expect(walk.T).toBe(0);
		expect(Array.from(walk.tokensAt(0))).toEqual([1, 2, 3]);
		expect(walk.rows).toHaveLength(3);
	});

	it('appends by copying the visible row and replacing one position', () => {
		const walk = new HandWalk(initial(), 10);
		expect(walk.jump(0, 1, 9)).toBe(true);
		expect(walk.T).toBe(1);
		expect(Array.from(walk.tokensAt(0))).toEqual([1, 2, 3]);
		expect(Array.from(walk.tokensAt(1))).toEqual([1, 9, 3]);
	});

	it('branches from an earlier row and discards the future', () => {
		const walk = new HandWalk(initial(), 10);
		walk.jump(0, 0, 8);
		walk.jump(1, 2, 9);
		expect(walk.T).toBe(2);

		expect(walk.jump(0, 2, 7)).toBe(true);
		expect(walk.T).toBe(1);
		expect(Array.from(walk.tokensAt(1))).toEqual([1, 2, 7]);
		// The discarded row cannot be reached again by time travel.
		expect(walk.tokensAt(2)).toHaveLength(3);
	});

	it('appends a full row, discards the future, and respects the horizon', () => {
		const walk = new HandWalk(initial(), 2);
		walk.jump(0, 1, 9);
		expect(walk.append(1, Int32Array.from([7, 8, 9]))).toBe(true);
		expect(walk.T).toBe(2);
		expect(Array.from(walk.tokensAt(2))).toEqual([7, 8, 9]);

		expect(walk.append(2, Int32Array.from([0, 0, 0]))).toBe(false);
		expect(walk.append(0, Int32Array.from([4, 5, 6]))).toBe(true);
		expect(walk.T).toBe(1);
		expect(Array.from(walk.tokensAt(1))).toEqual([4, 5, 6]);
		expect(walk.append(1, Int32Array.from([1, 2]))).toBe(false);
	});

	it('undoes the tail and is a no-op at T = 0', () => {
		const walk = new HandWalk(initial(), 10);
		expect(walk.undo()).toBe(false);
		walk.jump(0, 0, 8);
		expect(walk.undo()).toBe(true);
		expect(walk.T).toBe(0);
		expect(walk.undo()).toBe(false);
	});

	it('refuses jumps outside the horizon or the row', () => {
		const walk = new HandWalk(initial(), 1);
		expect(walk.jump(0, -1, 9)).toBe(false);
		expect(walk.jump(0, 3, 9)).toBe(false);
		expect(walk.jump(1, 0, 9)).toBe(false);
		expect(walk.jump(0, 0, 9)).toBe(true);
		expect(walk.jump(1, 0, 9)).toBe(false);
	});

	it('matches a naive reference under random jumps and undos', () => {
		const prng = seedrandom.alea('hand-walk-differential' + '\0');
		const L = 5;
		const maxSteps = 4;
		const input = Int32Array.from({ length: L }, () => Math.floor(prng() * 9));
		const walk = new HandWalk(input, maxSteps);
		let rows: number[][] = [Array.from(input)];

		const refJump = (from: number, position: number, tokenId: number): boolean => {
			if (from < 0 || from > rows.length - 1) return false;
			if (from >= maxSteps) return false;
			if (position < 0 || position >= L) return false;
			const row = rows[from]!.slice();
			row[position] = tokenId;
			rows = [...rows.slice(0, from + 1), row];
			return true;
		};

		const refUndo = (): boolean => {
			if (rows.length === 1) return false;
			rows.pop();
			return true;
		};

		const check = () => {
			expect(walk.T).toBe(rows.length - 1);
			expect(Array.from(walk.rows)).toEqual(rows.flat());
			for (let t = 0; t <= walk.T; t++) {
				expect(Array.from(walk.tokensAt(t))).toEqual(rows[t]);
			}
		};

		for (let i = 0; i < 2000; i++) {
			if (prng() < 0.3) {
				expect(walk.undo()).toBe(refUndo());
			} else {
				const from = Math.floor(prng() * (walk.T + 3)) - 1;
				const position = Math.floor(prng() * (L + 2)) - 1;
				const tokenId = Math.floor(prng() * 9);
				expect(walk.jump(from, position, tokenId)).toBe(refJump(from, position, tokenId));
			}
			check();
		}
	});
});
