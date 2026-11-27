/**
 * Growable hand-walk trail: row $0$ is the encoded input and every later
 * row copies one visible row and replaces exactly one position.
 *
 * No RNG and no future: the reader's jumps decide the next row. The buffer
 * is preallocated at `(maxSteps + 1) * L` cells and rows beyond the built
 * tail are overwritten, so branching from an earlier row truncates the
 * future instead of growing a tree.
 */
export class HandWalk {
	/** Sequence length $L$. */
	readonly length: number;
	/** Maximum number of jumps the trail may hold. */
	readonly maxSteps: number;

	private readonly buffer: Int32Array;
	/** Number of built steps $T$; row $T$ is the visible tail. */
	private _T = 0;

	/**
	 * @param inputIds - Row $0$, length $L$.
	 * @param maxSteps - Maximum $T$ (the schedule horizon).
	 */
	constructor(inputIds: Int32Array, maxSteps: number) {
		this.length = inputIds.length;
		this.maxSteps = Math.max(0, maxSteps);
		this.buffer = new Int32Array((this.maxSteps + 1) * this.length);
		this.buffer.set(inputIds);
	}

	/** Number of built steps $T$. */
	get T(): number {
		return this._T;
	}

	/** The built rows, row-major $(T+1) \times L$. */
	get rows(): Int32Array {
		return this.buffer.subarray(0, (this._T + 1) * this.length);
	}

	/** Row $t$ as a view; no copy. */
	tokensAt(t: number): Int32Array {
		const L = this.length;
		return this.buffer.subarray(t * L, (t + 1) * L);
	}

	/**
	 * Append one row from visible row `from`: copy every cell, then replace
	 * `position` with `tokenId`. Rows after `from` are discarded. Fails when
	 * `from` or `position` is out of range, or the jump would exceed the
	 * horizon.
	 */
	jump(from: number, position: number, tokenId: number): boolean {
		if (from < 0 || from > this._T) return false;
		if (from >= this.maxSteps) return false;
		if (position < 0 || position >= this.length) return false;

		const L = this.length;
		const src = from * L;
		const dst = (from + 1) * L;
		this.buffer.copyWithin(dst, src, src + L);
		this.buffer[dst + position] = tokenId;
		this._T = from + 1;
		return true;
	}

	/**
	 * Append a full row from visible row `from`: copy every cell of `row`,
	 * discard the future, and make the copy the new tail. Fails when `from`
	 * is out of range, `row` is not length $L$, or the step would exceed
	 * the horizon.
	 */
	append(from: number, row: Int32Array): boolean {
		if (from < 0 || from > this._T) return false;
		if (from >= this.maxSteps) return false;
		if (row.length !== this.length) return false;

		this.buffer.set(row, (from + 1) * this.length);
		this._T = from + 1;
		return true;
	}

	/** Pop the tail row; a no-op at $T = 0$. */
	undo(): boolean {
		if (this._T === 0) return false;
		this._T--;
		return true;
	}
}
