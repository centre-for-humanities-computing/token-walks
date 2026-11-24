<script lang="ts">
	import NeighborGraph from './NeighborGraph.svelte';
	import type { NeighborGraph as NeighborGraphData } from '$lib/workers/trajectory.protocol.js';

	interface Props {
		/** Viewport-space anchor point (top-left of the hovered token). */
		x: number;
		y: number;
		/**
		 * Tooltip state: `loading` while querying, `ready` with a graph,
		 * `error` when graph construction failed, `unavailable` when the
		 * strategy has no neighborhood support (trajectory still shown).
		 */
		state: 'loading' | 'ready' | 'error' | 'unavailable';
		/** The graph, when `state === 'ready'`. */
		graph: NeighborGraphData | null;
		/** True while a click pinned this inspector. */
		pinned?: boolean;
		/** Token id at the focused step; rings and ramps against it. */
		focusId: number;
		/** Step the graph was focused on. */
		focusStep: number;
		/** Remove the pinned inspector. */
		onclose?: () => void;
		/** Called with a neighbor's token id when it is jumped to. */
		onpick?: (id: number) => void;
	}

	let { x, y, state, graph, pinned = false, focusId, focusStep, onclose, onpick }: Props = $props();

	const OFFSET = 12;
	/** Tooltip width; position flips to the left when near the right edge. */
	const WIDTH = 380;

	const style = $derived.by(() => {
		const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
		const flip = x + WIDTH + OFFSET > vw;
		const left = flip ? x - WIDTH - OFFSET : x + OFFSET;
		return `left: ${left}px; top: ${y + OFFSET}px; width: ${WIDTH}px;`;
	});
</script>

<div class="token-tooltip" class:pinned {style} role="tooltip">
	{#if pinned}
		<button class="close-btn" aria-label="Close inspector" onclick={() => onclose?.()}>×</button>
	{/if}
	{#if state === 'loading'}
		<p class="msg">Reading inspector…</p>
	{:else if state === 'error'}
		<p class="msg error">Failed to compute the inspection graph.</p>
	{:else if state === 'unavailable'}
		<p class="msg">Neighborhood not available for this strategy.</p>
	{:else if graph}
		<NeighborGraph {graph} {focusId} {focusStep} {onpick} />
	{/if}
</div>

<style>
	.token-tooltip {
		position: fixed;
		z-index: 200;
		background: #fff;
		border: 1px solid #ccc;
		border-radius: 6px;
		box-shadow: 0 2px 10px rgba(0, 0, 0, 0.15);
		padding: 8px;
		pointer-events: none;
	}

	/* A pinned inspector keeps receiving pointer events so it survives the
	   pointer leaving the token and entering the tooltip. */
	.token-tooltip.pinned {
		pointer-events: auto;
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
</style>
