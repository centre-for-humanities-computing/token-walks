<script lang="ts">
	import type { TokenCharSpan } from '$lib/engine/diff.js';

	interface Props {
		text: string;
		/** Per-token character spans (from `allTokenCharSpans`). */
		spans?: readonly TokenCharSpan[];
		/** Whether a click on this position can open the inspector. */
		inspectable?: (index: number) => boolean;
		/** Position whose inspector is currently open. */
		pinnedIndex?: number | null;
		/** Called on click/Enter/Space to open the inspector. */
		onpin?: (tokenId: number, index: number, rect: DOMRect) => void;
	}

	let { text, spans = [], inspectable, pinnedIndex = null, onpin }: Props = $props();

	/**
	 * Split `text` into per-token segments. Each span contributes its slice
	 * of `text`; gaps between spans (mask positions, empty tokens) are
	 * emitted as plain text. Spans must be sorted and non-overlapping.
	 */
	function segments(
		text: string,
		spans: readonly TokenCharSpan[],
	): Array<{ text: string; span?: TokenCharSpan }> {
		const out: Array<{ text: string; span?: TokenCharSpan }> = [];
		let pos = 0;
		for (const s of spans) {
			if (s.start > pos) {
				out.push({ text: text.slice(pos, s.start) });
			}
			if (s.end > s.start) {
				out.push({ text: text.slice(s.start, s.end), span: s });
			}
			pos = s.end;
		}
		if (pos < text.length) {
			out.push({ text: text.slice(pos) });
		}
		return out;
	}
</script>

{#if spans.length === 0}
	<p class="inline-text" data-testid="prose-text">{text}</p>
{:else}
	<p class="inline-text" data-testid="prose-text">
		{#each segments(text, spans) as seg, i (i)}
			{#if seg.span}
				<span
					class="taper"
					class:inspectable={inspectable?.(seg.span.index)}
					class:pinned={pinnedIndex === seg.span.index}
					style="--r: {seg.span.recency}"
					data-testid="prose-token"
					data-start={seg.span.start}
					data-end={seg.span.end}
					data-token-id={seg.span.tokenId}
					role="button"
					tabindex={0}
					aria-label="token {seg.text}"
					onclick={(e) =>
						onpin?.(seg.span!.tokenId, seg.span!.index, e.currentTarget.getBoundingClientRect())}
					onkeydown={(e) => {
						if (e.key !== 'Enter' && e.key !== ' ') return;
						e.preventDefault();
						onpin?.(seg.span!.tokenId, seg.span!.index, e.currentTarget.getBoundingClientRect());
					}}>{seg.text}</span
				>
			{:else}
				{seg.text}
			{/if}
		{/each}
	</p>
{/if}

<style>
	.inline-text {
		font-family: system-ui, sans-serif;
		font-size: 1rem;
		line-height: 1.7;
		white-space: pre-wrap;
		word-break: break-word;
		margin: 0;
	}

	.taper:hover,
	.taper:focus-visible {
		outline: 2px solid #3b82f6;
		outline-offset: 1px;
	}
	.taper:not(.inspectable):hover,
	.taper:not(.inspectable):focus-visible {
		outline-color: #e8a0a0;
	}
	.taper.pinned {
		outline: 2px solid #1d4ed8;
		outline-offset: 1px;
	}
	.taper {
		/*
		 * Fading highlight: recency $r \in [0, 1]$ drives the background
		 * opacity. $r = 1$ (just changed) → full highlight; $r \to 0$ → no
		 * highlight. The color is a warm amber that fades to transparent.
		 */
		background: rgba(255, 200, 50, var(--r));
		border-radius: 2px;
		transition: background 0.15s;
	}

	@media (prefers-reduced-motion: reduce) {
		.taper {
			transition: none;
		}
	}
</style>
