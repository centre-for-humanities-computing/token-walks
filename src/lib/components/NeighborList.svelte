<script lang="ts">
	import type { NeighborListPage } from '$lib/workers/trajectory.protocol.js';

	interface Props {
		/** One page of the focused token's stored neighbourhood. */
		page: NeighborListPage;
		/** Called with a row's token id when it is jumped to. */
		onpick?: (id: number) => void;
	}

	let { page, onpick }: Props = $props();
</script>

<div class="neighbor-list">
	<p class="caption">Neighbours ({page.total})</p>
	{#if page.entries.length === 0}
		<p>No stored neighbours.</p>
	{:else}
		<ul>
			{#each page.entries as e (`${e.id}-${e.dist}`)}
				<li>
					<button
						type="button"
						class="row"
						aria-label="Jump to token {e.label || `#${e.id}`}, distance {e.dist}"
						onclick={() => onpick?.(e.id)}
					>
						<span class="label">{e.label || `#${e.id}`}</span>
						<span class="id">#{e.id}</span>
						<span class="dist">{e.dist}</span>
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.neighbor-list {
		margin-top: 6px;
		border-top: 1px solid #eee;
		padding-top: 6px;
		font:
			0.75rem system-ui,
			sans-serif;
		color: #555;
	}

	p {
		margin: 0 0 4px;
	}

	ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.row {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto auto;
		gap: 8px;
		width: 100%;
		border: 0;
		border-radius: 3px;
		background: transparent;
		padding: 2px 4px;
		font: inherit;
		color: inherit;
		text-align: left;
		cursor: pointer;
	}

	.row:hover,
	.row:focus-visible {
		background: #f5edd8;
	}

	.label {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>
