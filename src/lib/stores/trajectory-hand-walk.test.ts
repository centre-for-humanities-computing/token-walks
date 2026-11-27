import { describe, it, expect } from 'vitest';
import { trajectoryStore } from './trajectory.svelte.js';

describe('trajectoryStore hand walk', () => {
	it('opens ready on one row without computing', () => {
		trajectoryStore.begin(Int32Array.from([4, 5, 6]), { vocabSize: 10, maxSteps: 300 });

		expect(trajectoryStore.status).toBe('ready');
		expect(trajectoryStore.t).toBe(0);
		expect(trajectoryStore.trajectory?.T).toBe(0);
		expect(trajectoryStore.trajectory?.length).toBe(3);
		expect(Array.from(trajectoryStore.trajectory!.tokensAt(0))).toEqual([4, 5, 6]);
	});

	it('jumps from the visible row and follows the new tail', () => {
		trajectoryStore.begin(Int32Array.from([1, 2, 3]), { vocabSize: 10, maxSteps: 300 });
		expect(trajectoryStore.jump(1, 9)).toBe(true);

		expect(trajectoryStore.t).toBe(1);
		expect(trajectoryStore.trajectory?.T).toBe(1);
		expect(Array.from(trajectoryStore.trajectory!.tokensAt(1))).toEqual([1, 9, 3]);
	});

	it('branches from an earlier row and replaces the future', () => {
		trajectoryStore.begin(Int32Array.from([1, 2, 3]), { vocabSize: 10, maxSteps: 300 });
		trajectoryStore.jump(1, 9);
		trajectoryStore.jump(2, 7);
		expect(trajectoryStore.trajectory?.T).toBe(2);

		trajectoryStore.t = 0;
		expect(trajectoryStore.jump(0, 5)).toBe(true);
		expect(trajectoryStore.t).toBe(1);
		expect(trajectoryStore.trajectory?.T).toBe(1);
		expect(Array.from(trajectoryStore.trajectory!.tokensAt(1))).toEqual([5, 2, 3]);
	});

	it('appends a full row and follows the new tail', () => {
		trajectoryStore.begin(Int32Array.from([1, 2, 3]), { vocabSize: 10, maxSteps: 300 });
		trajectoryStore.jump(1, 9);
		expect(trajectoryStore.append(Int32Array.from([7, 8, 9]))).toBe(true);

		expect(trajectoryStore.t).toBe(2);
		expect(trajectoryStore.trajectory?.T).toBe(2);
		expect(Array.from(trajectoryStore.trajectory!.tokensAt(2))).toEqual([7, 8, 9]);

		trajectoryStore.t = 0;
		expect(trajectoryStore.append(Int32Array.from([4, 5, 6]))).toBe(true);
		expect(trajectoryStore.t).toBe(1);
		expect(trajectoryStore.trajectory?.T).toBe(1);
		expect(Array.from(trajectoryStore.trajectory!.tokensAt(1))).toEqual([4, 5, 6]);
	});

	it('undoes the tail, refuses when scrubbed back, and jumps again', () => {
		trajectoryStore.begin(Int32Array.from([1, 2, 3]), { vocabSize: 10, maxSteps: 300 });
		trajectoryStore.jump(1, 9);
		trajectoryStore.jump(2, 7);

		trajectoryStore.t = 0;
		expect(trajectoryStore.undo()).toBe(false);
		expect(trajectoryStore.trajectory?.T).toBe(2);

		trajectoryStore.t = 2;
		expect(trajectoryStore.undo()).toBe(true);
		expect(trajectoryStore.t).toBe(1);
		expect(Array.from(trajectoryStore.trajectory!.tokensAt(1))).toEqual([1, 9, 3]);

		expect(trajectoryStore.jump(2, 8)).toBe(true);
		expect(trajectoryStore.trajectory?.T).toBe(2);
		expect(Array.from(trajectoryStore.trajectory!.tokensAt(2))).toEqual([1, 9, 8]);

		trajectoryStore.t = 0;
		expect(trajectoryStore.undo()).toBe(false);
	});

	it('never lets hand-walk rows enter the trajectory cache', () => {
		trajectoryStore.begin(Int32Array.from([1, 2, 3]), { vocabSize: 10, maxSteps: 300 });
		const before = trajectoryStore.cacheSize;
		trajectoryStore.jump(1, 9);
		trajectoryStore.jump(2, 7);
		trajectoryStore.t = 0;
		trajectoryStore.jump(0, 5);
		trajectoryStore.t = 1;
		trajectoryStore.append(Int32Array.from([9, 9, 9]));
		trajectoryStore.undo();
		expect(trajectoryStore.cacheSize).toBe(before);
	});
});
