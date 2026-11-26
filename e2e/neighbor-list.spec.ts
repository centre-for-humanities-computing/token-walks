// The inspector's stored-neighbourhood list: page 0 under the graph,
// "Load more" appending past the graph's top eight, and a jump resetting
// the list to page 0 for the new token.
import { expect, test, type Page } from '@playwright/test';
import { readProse } from './prose';

const TIMEOUT = 120_000;
const INPUT = 'The quick brown fox';

async function openTrail(page: Page): Promise<void> {
	await page.goto('/');
	await expect(page.getByTestId('app-status')).toHaveAttribute('data-trajectory-status', 'ready', {
		timeout: TIMEOUT,
	});
	await page.getByRole('button', { name: 'Edit' }).click();
	await page.getByTestId('input-text').fill(INPUT);
	await expect(page.getByTestId('noise-button')).toBeEnabled({ timeout: TIMEOUT });
	await page.getByTestId('noise-button').click();
	await expect(page.getByTestId('app-status')).toHaveAttribute('data-trajectory-status', 'ready', {
		timeout: TIMEOUT,
	});
}

/** Click a prose token and wait for its pinned inspector. */
async function pin(page: Page, index: number): Promise<void> {
	await page.getByTestId('prose-token').nth(index).click();
	await expect(page.getByRole('tooltip')).toBeVisible({ timeout: TIMEOUT });
}

/** Jump to the first neighbour node in the pinned inspector. */
async function pick(page: Page): Promise<void> {
	const tooltip = page.getByRole('tooltip');
	const node = tooltip.locator('g.node.neighbor[role="button"]').first();
	await expect(node).toBeVisible({ timeout: TIMEOUT });
	await node.locator('circle').click();
	await expect(tooltip).toBeVisible();
}

test('neighbor list: pages past eight and resets after a jump', async ({ page }) => {
	const errors: string[] = [];
	page.on('pageerror', (e) => errors.push(e.message));
	page.on('console', (m) => {
		if (m.type() === 'error') errors.push(m.text());
	});

	await openTrail(page);
	await page.getByTestId('prose-token').nth(1).click();

	const tooltip = page.getByRole('tooltip');
	const rows = tooltip.locator('.neighbor-list .row');
	await expect(rows.first()).toBeVisible({ timeout: TIMEOUT });
	await expect(tooltip.locator('.neighbor-list .caption')).toContainText('Neighbours (');

	// The graph keeps its top-eight overview while the list reaches further.
	const graphNodes = await tooltip.locator('g.node.neighbor').count();
	expect(graphNodes).toBeLessThanOrEqual(8);
	const firstPage = await rows.count();
	expect(firstPage).toBeGreaterThan(8);

	// "Load more" appends the next page; no gaps or duplicates by construction.
	await tooltip.getByRole('button', { name: 'Load more' }).click();
	await expect.poll(() => rows.count()).toBeGreaterThan(firstPage);

	// A row beyond the graph's eight is a legal jump: one row appended.
	await rows.nth(9).click();
	await expect(page.getByTestId('t-max')).toHaveText('1');
	await expect(page.locator('.readout')).toContainText('t = 1 / 1');

	// The new token starts its list at page 0 again.
	await expect.poll(() => rows.count()).toBeLessThanOrEqual(25);

	expect(errors).toEqual([]);
});

test('neighbor list: jumps to a row the kernel never offered', async ({ page }) => {
	const errors: string[] = [];
	page.on('pageerror', (e) => errors.push(e.message));
	page.on('console', (m) => {
		if (m.type() === 'error') errors.push(m.text());
	});

	await openTrail(page);

	// The kernel reaches distance 1; the list still holds the stored 3.
	await page.getByRole('button', { name: /Advanced/ }).click();
	const param = page.locator('label', { hasText: 'Max distance' });
	await param.locator('input[type="range"]').evaluate((el) => {
		const input = el as HTMLInputElement;
		input.value = '1';
		input.dispatchEvent(new Event('input', { bubbles: true }));
	});
	await expect(param.locator('.param-value')).toHaveText('1');

	// Two ordinary jumps build a future to discard.
	await pin(page, 1);
	await pick(page);
	await pin(page, 2);
	await pick(page);
	await expect(page.getByTestId('t-max')).toHaveText('2');

	// Branch from row 0, then jump through the list with the keyboard.
	await page.getByTestId('time-slider').fill('0');
	await expect(page.locator('.readout')).toContainText('t = 0 / 2');
	const row0 = (await readProse(page))!;

	await pin(page, 2);
	const tooltip = page.getByRole('tooltip');
	const rows = tooltip.locator('.neighbor-list .row');
	await expect(rows.first()).toBeVisible({ timeout: TIMEOUT });
	const dists = await rows.locator('.dist').allTextContents();
	const far = dists.findIndex((d) => Number(d) >= 2);
	expect(far).toBeGreaterThanOrEqual(0);

	await rows.nth(far).focus();
	await page.keyboard.press('Enter');
	await expect(page.getByTestId('t-max')).toHaveText('1');
	await expect(page.locator('.readout')).toContainText('t = 1 / 1');

	// One row appended; every other cell is copied from row 0.
	const branch = (await readProse(page))!;
	expect(branch.spans[2]!.text).not.toBe(row0.spans[2]!.text);
	expect(branch.spans[0]!.text).toBe(row0.spans[0]!.text);
	expect(branch.spans[1]!.text).toBe(row0.spans[1]!.text);
	expect(branch.spans[3]!.text).toBe(row0.spans[3]!.text);

	expect(errors).toEqual([]);
});
