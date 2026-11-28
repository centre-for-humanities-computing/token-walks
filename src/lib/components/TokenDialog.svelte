<script lang="ts">
	import NeighborGraph from './NeighborGraph.svelte';
	import NeighborList from './NeighborList.svelte';
	import type {
		NeighborGraph as NeighborGraphData,
		NeighborListPage,
	} from '$lib/workers/trajectory.protocol.js';

	interface Props {
		/** Viewport-space anchor point (top-left of the clicked token). */
		x: number;
		y: number;
		/**
		 * Dialog state: `loading` while querying, `ready` with a graph,
		 * `error` when graph construction failed, `unavailable` when the
		 * strategy has no neighborhood support.
		 */
		state: 'loading' | 'ready' | 'error' | 'unavailable';
		/** The graph, when `state === 'ready'`. */
		graph: NeighborGraphData | null;
		/** The stored-neighbourhood page below the graph, when available. */
		list?: NeighborListPage | null;
		/** Token id at the focused step; rings and ramps against it. */
		focusId: number;
		/** Step the graph was focused on. */
		focusStep: number;
		/** Whether the focused position is frozen for a hand-walk step. */
		frozen?: boolean;
		/** Ergodicity floor of the active kernel; shows the caveat above 0. */
		epsilon?: number;
		/** True while one step is in flight. */
		flipping?: boolean;
		/** True at the trail's snapshotted horizon. */
		atHorizon?: boolean;
		/** Force a jump to one next token at the focused position. */
		onflip?: () => void;
		/** Close the inspector. */
		onclose?: () => void;
		/** Called with a neighbor's token id when it is jumped to. */
		onpick?: (id: number) => void;
		/** Append the next page of the stored neighbourhood. */
		onloadmore?: () => void;
	}

	let {
		x,
		y,
		state,
		graph,
		focusId,
		focusStep,
		frozen = false,
		epsilon = 0,
		flipping = false,
		atHorizon = false,
		onflip,
		onclose,
		onpick,
		onloadmore,
		list = null,
	}: Props = $props();

	const OFFSET = 12;
	/** Dialog width; position flips to the left when near the right edge. */
	const WIDTH = 380;

	const style = $derived.by(() => {
		const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
		const vh = typeof window !== 'undefined' ? window.innerHeight : 900;
		const flip = x + WIDTH + OFFSET > vw;
		const left = flip ? x - WIDTH - OFFSET : x + OFFSET;
		// Keep the pinned inspector inside the viewport: clamp its top up when
		// there is too little room below, then let the content scroll.
		const MIN_HEIGHT = 160;
		const top = Math.min(y + OFFSET, Math.max(8, vh - MIN_HEIGHT - 8));
		const maxHeight = Math.max(0, vh - top - 8);
		return `left: ${left}px; top: ${top}px; width: ${WIDTH}px; max-height: ${maxHeight}px;`;
	});
</script>

<div class="token-dialog" {style} role="dialog" aria-label="Token inspector">
	<button class="close-btn" aria-label="Close inspector" onclick={() => onclose?.()}>×</button>
	{#if state === 'loading'}
		<p class="msg">Reading inspector…</p>
	{:else if state === 'error'}
		<p class="msg error">Failed to compute the inspection graph.</p>
	{:else if state === 'unavailable'}
		<p class="msg">Neighborhood not available for this strategy.</p>
	{:else if graph}
		<NeighborGraph {graph} {focusId} {focusStep} {onpick} />
		{#if list?.hasNeighborhood}
			<NeighborList page={list} {onpick} {onloadmore} />
		{/if}
	{/if}
	<div class="pin-actions">
		<button
			class="flip-btn"
			data-testid="flip-button"
			disabled={frozen || atHorizon || flipping || state === 'loading' || state === 'error'}
			title="Force a jump to one next token from the active kernel at this position"
			onclick={() => onflip?.()}
		>
			Flip this token
		</button>
		{#if epsilon > 0}
			<p class="note">The sample may leave the drawn graph because the kernel has an ε floor.</p>
		{/if}
		{#if frozen}
			<p class="note">This position is frozen, so it cannot be flipped.</p>
		{/if}
	</div>
</div>

<style>
	.token-dialog {
		position: fixed;
		z-index: 200;
		background: #fff;
		border: 1px solid #ccc;
		border-radius: 6px;
		box-shadow: 0 2px 10px rgba(0, 0, 0, 0.15);
		padding: 8px;
		/* Long lists scroll inside the clamped dialog; no motion. */
		overflow-y: auto;
	}

	.close-btn {
		position: absolute;
		top: 2px;
		right: 4px;
		border: none;
		background: transparent;
		font-size: 1rem;
		line-height: 1;
		color: #666;
		cursor: pointer;
		padding: 0 2px;
	}

	.close-btn:hover {
		color: #222;
	}

	.msg {
		margin: 0;
		font-size: 0.8rem;
		color: #555;
		font-family: system-ui, sans-serif;
	}

	.msg.error {
		color: #a33;
	}

	.pin-actions {
		margin-top: 6px;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.flip-btn {
		align-self: flex-start;
		padding: 0.3rem 0.7rem;
		font-size: 0.8rem;
		border: 1px solid #bbb;
		border-radius: 4px;
		background: #f7f7f7;
		cursor: pointer;
	}

	.flip-btn:hover:not(:disabled) {
		background: #eee;
	}

	.flip-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.note {
		margin: 0;
		font-size: 0.7rem;
		color: #555;
		font-family: system-ui, sans-serif;
	}
</style>
