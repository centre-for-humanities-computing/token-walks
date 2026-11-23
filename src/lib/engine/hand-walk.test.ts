import { describe, it, expect } from 'vitest';
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
});
