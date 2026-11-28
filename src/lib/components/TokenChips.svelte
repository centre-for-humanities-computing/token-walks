<script lang="ts">
	interface Props {
		tokens: readonly string[];
		ids: Int32Array;
		recency: Float32Array;
		/** Whether a click on this position can open the inspector. */
		inspectable?: (index: number) => boolean;
		/** Position whose inspector is currently open. */
		pinnedIndex?: number | null;
		/** Called on click/Enter/Space to open the inspector. */
		onpin?: (tokenId: number, index: number, rect: DOMRect) => void;
	}

	let { tokens, ids, recency, inspectable, pinnedIndex = null, onpin }: Props = $props();

	/**
	 * Make whitespace and control characters visible in chip labels.
	 * BPE uses `Ġ` (U+0120) for leading space; WordPiece uses `##` prefix.
	 * We also replace literal space/newline/tab with visible glyphs.
	 */
	function visibleToken(t: string): string {
		return t.replace(/ /g, '␣').replace(/\n/g, '↵').replace(/\t/g, '→');
	}
</script>

<div class="chips">
	{#each tokens as token, i (i)}
		<span
			class="chip"
			class:changed={recency[i]! > 0}
			class:inspectable={inspectable?.(i)}
			class:pinned={pinnedIndex === i}
			style="--r: {recency[i]!}"
			role="button"
			tabindex={0}
			aria-label="token {visibleToken(token)}"
			onclick={(e) => {
				const id = ids[i];
				if (id !== undefined && onpin) onpin(id, i, e.currentTarget.getBoundingClientRect());
			}}
			onkeydown={(e) => {
				if (e.key !== 'Enter' && e.key !== ' ') return;
				e.preventDefault();
				const id = ids[i];
				if (id !== undefined && onpin) onpin(id, i, e.currentTarget.getBoundingClientRect());
			}}
		>
			<span class="chip-token">{visibleToken(token)}</span>
			<span class="chip-id">{ids[i] ?? '?'}</span>
		</span>
	{/each}
</div>

<style>
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		font-family: monospace;
	}
	.chip {
		display: inline-flex;
		align-items: center;
		gap: 3px;
		background: #e8e8e8;
		border-radius: 4px;
		padding: 2px 6px;
		font-size: 0.85rem;
	}
	.chip.changed {
		/*
		 * Fading highlight: recency $r \in [0, 1]$ drives the background
		 * blend. $r = 1$ (just changed) → full amber; $r \to 0$ → base gray.
		 * We layer a semi-transparent amber over the base gray using a
		 * linear-gradient trick: the amber layer's opacity is var(--r).
		 */
		background:
			linear-gradient(rgba(255, 200, 50, var(--r)), rgba(255, 200, 50, var(--r))), #e8e8e8;
		border-bottom: 2px solid rgba(184, 134, 11, var(--r));
		transition:
			background 0.15s,
			border-color 0.15s;
	}
	.chip:hover,
	.chip:focus-visible {
		outline: 2px solid #3b82f6;
		outline-offset: 1px;
	}
	.chip:not(.inspectable):hover,
	.chip:not(.inspectable):focus-visible {
		outline-color: #e8a0a0;
	}
	.chip.pinned {
		outline: 2px solid #1d4ed8;
		outline-offset: 1px;
	}
	.chip-token {
		color: #222;
	}
	.chip-id {
		color: #888;
		font-size: 0.7rem;
	}

	@media (prefers-reduced-motion: reduce) {
		.chip.changed {
			transition: none;
		}
	}
</style>
