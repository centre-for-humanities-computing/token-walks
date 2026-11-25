import { browser } from '$app/environment';
import { HandWalk } from '$lib/engine/hand-walk.js';
import { TrajectoryCache, hashIds } from '$lib/engine/trajectory-cache.js';
import type { Trajectory, TrajectorySpec } from '$lib/engine/types.js';
import type {
	TrajectoryWorkerRequest,
	TrajectoryWorkerResponse,
	TrajectoryWorkerNeighborsRequest,
	TrajectoryWorkerNeighborsListRequest,
	TrajectoryWorkerPhase,
	TrajectoryWorkerUnionGraphRequest,
	NeighborGraph,
	NeighborListPage,
} from '$lib/workers/trajectory.protocol.js';

export type TrajectoryStatus = 'idle' | 'computing' | 'ready' | 'error';

/** Page returned when the worker cannot answer (SSR or a list error). */
const EMPTY_NEIGHBOR_LIST: NeighborListPage = {
	entries: [],
	total: 0,
	atCap: false,
	hasNeighborhood: false,
};

/**
 * Reactive store for trajectory state.
 *
 * Owns the seed, current slider position $t$, the Web Worker lifecycle,
 * and the in-memory trajectory cache. Follows the same pattern as
 * `tokenizer.svelte.ts` (status union, error string, re-entrancy guard).
 */
class TrajectoryStore {
	/** Current random seed (editable by user). */
	seed: number = $state(42);
	/** Current slider position $t \in [0, T]$. */
	t: number = $state(0);
	/** Computation status. */
	status: TrajectoryStatus = $state('idle');
	/** Error message when status is `'error'`. */
	error: string | null = $state(null);
	/**
	 * The computed trajectory, or null. Raw state: it is immutable, and a
	 * cache hit re-assigns the same object, which must not look like a new one.
	 */
	trajectory: Trajectory | null = $state.raw(null);
	/**
	 * Effective vocabulary size $K_{\text{eff}}$ of the displayed trajectory.
	 * 0 until a trajectory arrives. Kept separate from the tokenizer's static
	 * size so an older trajectory keeps its own mask sentinel while a text
	 * edit is recomputing.
	 */
	vocabSize: number = $state(0);
	/**
	 * Progress fraction in $[0, 1]$ for the current phase, for progress bar.
	 * Only meaningful while computing.
	 */
	progress: number = $state(0);
	/** Current computation phase while status is `'computing'`; null otherwise. */
	phase: TrajectoryWorkerPhase | null = $state(null);
	/** Elapsed seconds of the in-flight computation, ticked while computing. */
	elapsed: number = $state(0);

	/** Monotonic request id for staleness detection. */
	private _requestId = 0;
	/** Monotonic request id for neighbor queries (separate counter). */
	private _neighborRequestId = 0;
	/** Pending neighbor-query resolvers keyed by request id. */
	private _pendingNeighborQueries = new Map<number, (graph: NeighborGraph) => void>();
	/** Monotonic request id for neighbour-list pages (separate counter). */
	private _neighborListRequestId = 0;
	/** Pending neighbour-list resolvers keyed by request id. */
	private _pendingNeighborListQueries = new Map<number, (page: NeighborListPage) => void>();
	/** Listeners for union-graph responses (owned by the graph store). */
	private _unionListeners = new Set<(msg: TrajectoryWorkerResponse) => void>();
	/** The worker instance, created lazily. */
	private _worker: Worker | null = null;
	/** In-memory trajectory cache. */
	private _cache = new TrajectoryCache();
	/** The hand-walk trail behind the displayed rows, when one is active. */
	private _trail: HandWalk | null = null;
	/** Re-entrancy guard: true while a compute is in flight. */
	private _computing = false;
	/** The spec for the in-flight (or most recent) request, for caching. */
	private _pendingSpec: TrajectorySpec | null = null;
	/** Queued spec: stored when a request arrives while already computing. */
	private _queuedSpec: TrajectorySpec | null = null;
	/** performance.now() timestamp when the current computation started. */
	private _startedAt = 0;
	/** Interval handle ticking `elapsed` while computing. */
	private _elapsedTimer: ReturnType<typeof setInterval> | null = null;

	/**
	 * Request a trajectory computation.
	 *
	 * Checks the cache first. If a cache miss, posts to the worker.
	 * Ignores responses for stale requestIds.
	 *
	 * @param spec - The trajectory specification.
	 */
	request(spec: TrajectorySpec): void {
		if (!browser) return;

		const inputHash = hashIds(spec.inputIds);
		const key = TrajectoryCache.key(spec, inputHash);

		// Cache hit — use immediately.
		const cached = this._cache.get(key);
		if (cached) {
			this.trajectory = cached;
			this.vocabSize = spec.vocabSize;
			this.status = 'ready';
			this.error = null;
			this.progress = 1;
			this.phase = null;
			if (!this._computing) this._stopElapsed();
			this._clampT(spec.T);
			return;
		}

		// Cache miss — compute.
		if (this._computing) {
			// Already computing; queue this spec for when the current one finishes.
			this._queuedSpec = spec;
			return;
		}

		this._computing = true;
		this._pendingSpec = spec;
		this.status = 'computing';
		this.error = null;
		this.progress = 0;
		this.phase = null;
		this._startElapsed();
		this._clampT(spec.T);

		const requestId = ++this._requestId;
		const worker = this._getWorker();

		const msg: TrajectoryWorkerRequest = {
			kind: 'compute',
			requestId,
			spec,
		};

		worker.postMessage(msg);
	}

	/**
	 * Open a hand-walk timeline with one row — the encoded input — and no
	 * future. Nothing is computed or cached; later jumps append rows.
	 *
	 * @param inputIds - Row $0$, length $L$.
	 * @param opts - Vocabulary size for display and the jump horizon.
	 */
	begin(inputIds: Int32Array, opts: { vocabSize: number; maxSteps: number }): void {
		this._trail = new HandWalk(inputIds, opts.maxSteps);

		// Invalidate any in-flight film-era compute so its result cannot
		// replace the hand-walk row.
		this._requestId++;
		this._computing = false;
		this._pendingSpec = null;
		this._queuedSpec = null;
		this._stopElapsed();

		this.vocabSize = opts.vocabSize;
		this.t = 0;
		this.status = 'ready';
		this.error = null;
		this.progress = 1;
		this.phase = null;
		this.trajectory = this._wrapTrail(this._trail);
	}

	/**
	 * Append one row from the visible row: replace `position` with
	 * `tokenId`, copy every other cell, discard the future, and follow the
	 * new tail. Returns false when there is no trail or the jump is out of
	 * range.
	 */
	jump(position: number, tokenId: number): boolean {
		const trail = this._trail;
		if (!trail || !trail.jump(this.t, position, tokenId)) return false;
		this.trajectory = this._wrapTrail(trail);
		this.t = trail.T;
		return true;
	}

	/** Pop the tail row and follow it. A no-op at $T = 0$ or when scrubbed back. */
	undo(): boolean {
		const trail = this._trail;
		if (!trail || this.t !== trail.T || !trail.undo()) return false;
		this.trajectory = this._wrapTrail(trail);
		this.t = trail.T;
		return true;
	}

	/** Number of cached film trajectories; hand-walk rows never enter it. */
	get cacheSize(): number {
		return this._cache.size;
	}

	/** Wrap the trail's built rows in the display `Trajectory` shape. */
	private _wrapTrail(trail: HandWalk): Trajectory {
		const rows = trail.rows;
		const length = trail.length;
		return {
			rows,
			T: trail.T,
			length,
			seed: this.seed,
			tokensAt(t: number): Int32Array {
				return rows.subarray(t * length, (t + 1) * length);
			},
		};
	}

	/**
	 * Query the inspection graph for a token (hover tooltip): the token's
	 * trajectory chain plus the 1-hop neighborhood of its current token.
	 *
	 * Posts a `neighbors` request to the worker and returns a promise
	 * resolved with the graph (always non-null; check `hasNeighborhood`).
	 * Independent of the trajectory compute pipeline.
	 *
	 * @param opts - Query parameters (tokenizer, strategy, config, the
	 *   token's trajectory column, schedule betas, spread limits).
	 */
	queryNeighbors(opts: {
		tokenizerId: string;
		strategyId: string;
		strategyConfig: Record<string, unknown>;
		vocabSize: number;
		/** Append-only OOV table: index `i` has id `Tokenizer.vocabSize + i`. */
		oovTokens?: readonly string[];
		column: Int32Array;
		/** Step in `column` to focus: only this node's 1-hop neighbors are drawn. */
		focusStep: number;
		betas: Float32Array;
		limitMode: 'top-k' | 'top-p';
		k: number;
		p: number;
	}): Promise<NeighborGraph> {
		if (!browser) {
			return Promise.resolve({ nodes: [], edges: [], hasNeighborhood: false });
		}

		const worker = this._getWorker();
		const requestId = ++this._neighborRequestId;

		return new Promise((resolve) => {
			this._pendingNeighborQueries.set(requestId, resolve);
			const msg: TrajectoryWorkerNeighborsRequest = {
				kind: 'neighbors',
				requestId,
				...opts,
			};
			worker.postMessage(msg);
		});
	}

	/**
	 * Query one page of a token's complete stored neighbourhood (the
	 * pinned inspector's list), in the provider's distance order.
	 *
	 * @param opts - Token, page window, and the strategy resource lookup.
	 */
	queryNeighborList(opts: {
		tokenizerId: string;
		strategyId: string;
		strategyConfig: Record<string, unknown>;
		vocabSize: number;
		/** Append-only OOV table: index `i` has id `Tokenizer.vocabSize + i`. */
		oovTokens?: readonly string[];
		/** Token whose stored neighbourhood is paged. */
		tokenId: number;
		offset: number;
		limit: number;
	}): Promise<NeighborListPage> {
		if (!browser) {
			return Promise.resolve(EMPTY_NEIGHBOR_LIST);
		}

		const worker = this._getWorker();
		const requestId = ++this._neighborListRequestId;

		return new Promise((resolve) => {
			this._pendingNeighborListQueries.set(requestId, resolve);
			const msg: TrajectoryWorkerNeighborsListRequest = {
				kind: 'neighbors-list',
				requestId,
				...opts,
			};
			worker.postMessage(msg);
		});
	}

	/**
	 * Post a union-graph build request to the worker (transferring the
	 * rows buffer). Responses arrive via the union listeners registered
	 * with `onUnionMessage`.
	 */
	postUnionGraph(msg: TrajectoryWorkerUnionGraphRequest): void {
		if (!browser) return;
		const worker = this._getWorker();
		worker.postMessage(msg, {
			transfer: [msg.rows.buffer as unknown as ArrayBuffer],
		});
	}

	/**
	 * Register a listener for union-graph responses (progress, result,
	 * error). The graph store owns the request lifecycle; the trajectory
	 * store only owns the worker. Returns an unregister function.
	 */
	onUnionMessage(handler: (msg: TrajectoryWorkerResponse) => void): () => void {
		this._unionListeners.add(handler);
		return () => this._unionListeners.delete(handler);
	}

	/**
	 * Handle a message from the worker.
	 * @internal — called from the worker `onmessage` handler.
	 */
	_handleWorkerMessage(event: MessageEvent<TrajectoryWorkerResponse>): void {
		const msg = event.data;

		// Union-graph responses dispatch to registered listeners.
		if (
			msg.kind === 'union-graph' ||
			msg.kind === 'union-graph-progress' ||
			msg.kind === 'union-graph-error'
		) {
			for (const h of this._unionListeners) h(msg);
			return;
		}

		// Neighbor-query responses use their own id space.
		if (msg.kind === 'neighbors' || msg.kind === 'neighbors-error') {
			const resolve = this._pendingNeighborQueries.get(msg.requestId);
			this._pendingNeighborQueries.delete(msg.requestId);
			if (resolve) {
				resolve(
					msg.kind === 'neighbors' ? msg.graph : { nodes: [], edges: [], hasNeighborhood: false },
				);
			}
			return;
		}

		// Neighbour-list pages use a third id space.
		if (msg.kind === 'neighbors-list' || msg.kind === 'neighbors-list-error') {
			const resolve = this._pendingNeighborListQueries.get(msg.requestId);
			this._pendingNeighborListQueries.delete(msg.requestId);
			if (resolve) {
				resolve(msg.kind === 'neighbors-list' ? msg : EMPTY_NEIGHBOR_LIST);
			}
			return;
		}

		// Ignore stale responses.
		if (msg.requestId !== this._requestId) return;

		switch (msg.kind) {
			case 'progress':
				this.progress = msg.total > 0 ? msg.step / msg.total : 1;
				this.phase = msg.phase;
				break;

			case 'result': {
				const traj: Trajectory = {
					rows: msg.rows,
					T: msg.T,
					length: msg.length,
					seed: msg.seed,
					coverage: msg.coverage,
					tokensAt(t: number): Int32Array {
						return this.rows.subarray(t * this.length, (t + 1) * this.length);
					},
				};
				this.trajectory = traj;
				this.status = 'ready';
				this.error = null;
				this.progress = 1;
				this.phase = null;
				this._stopElapsed();
				this._computing = false;

				// Cache the result under the spec that triggered it.
				if (this._pendingSpec) {
					this.vocabSize = this._pendingSpec.vocabSize;
					const key = TrajectoryCache.key(this._pendingSpec, hashIds(this._pendingSpec.inputIds));
					this._cache.set(key, traj);
					this._pendingSpec = null;
				}

				// Process any queued request.
				this._drainQueue();
				break;
			}

			case 'error':
				this.status = 'error';
				this.error = msg.message;
				this.progress = 0;
				this.phase = null;
				this._stopElapsed();
				this._computing = false;
				this._pendingSpec = null;

				// Process any queued request.
				this._drainQueue();
				break;
		}
	}

	/** Start the elapsed-time ticker for a fresh computation. */
	private _startElapsed(): void {
		this._stopElapsed();
		this._startedAt = performance.now();
		this.elapsed = 0;
		this._elapsedTimer = setInterval(() => {
			this.elapsed = (performance.now() - this._startedAt) / 1000;
		}, 250);
	}

	/** Stop the elapsed-time ticker. */
	private _stopElapsed(): void {
		if (this._elapsedTimer !== null) {
			clearInterval(this._elapsedTimer);
			this._elapsedTimer = null;
		}
	}

	/** Get or create the worker, wiring up the message handler. */
	private _getWorker(): Worker {
		if (!this._worker) {
			this._worker = new Worker(new URL('$lib/workers/trajectory.worker.ts', import.meta.url), {
				type: 'module',
			});
			this._worker.onmessage = (event: MessageEvent<TrajectoryWorkerResponse>) => {
				this._handleWorkerMessage(event);
			};
		}
		return this._worker;
	}

	/** Clamp $t$ to $[0, T]$ when $T$ shrinks. */
	private _clampT(T: number): void {
		if (this.t > T) {
			this.t = T;
		}
	}

	/** If a spec was queued while computing, send it now. */
	private _drainQueue(): void {
		const queued = this._queuedSpec;
		this._queuedSpec = null;
		if (queued) {
			this.request(queued);
		}
	}
}

export const trajectoryStore = new TrajectoryStore();
