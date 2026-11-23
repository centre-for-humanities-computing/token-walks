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
});
