// The hand-walk Show: one row in, pin a token, jump to a neighbour, branch
// from an earlier row, and undo. No trajectory is computed ahead.
import { expect, test, type Page } from '@playwright/test';
import { readProse } from './prose';

const TIMEOUT = 120_000;
const INPUT = 'The quick brown fox';

/** Enter Edit, fill the input, and return to Explore on row 0. */
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
	await expect(page.getByTestId('t-max')).toHaveText('0');
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

test('hand-walk: start, pin, jump, branch and undo', async ({ page }) => {
	const errors: string[] = [];
	page.on('pageerror', (e) => errors.push(e.message));
	page.on('console', (m) => {
		if (m.type() === 'error') errors.push(m.text());
	});

	await openTrail(page);

	// AC2: one row, t = 0 / 0, no future.
	await expect(page.locator('.readout')).toContainText('t = 0 / 0');
	await expect(page.getByTestId('time-slider')).toHaveAttribute('max', '0');
	const row0 = (await readProse(page))!;
	expect(row0.text).toBe(INPUT);
	expect(row0.spans).toHaveLength(4);

	// AC3: click pins the inspector at position 1; the chain shows the token.
	await pin(page, 1);
	const tooltip = page.getByRole('tooltip');
	await expect(tooltip.locator('svg')).toContainText('quick', { timeout: TIMEOUT });
	await expect(tooltip.getByRole('button', { name: 'Close inspector' })).toBeVisible();

	// AC4: a neighbour pick appends one row and follows it.
	await pick(page);
	await expect(page.getByTestId('t-max')).toHaveText('1');
	await expect(page.locator('.readout')).toContainText('t = 1 / 1');
	const row1 = (await readProse(page))!;
	expect(row1.spans[1]!.text).not.toBe(row0.spans[1]!.text);
	expect(row1.spans[0]!.text).toBe(row0.spans[0]!.text);
	expect(row1.spans[2]!.text).toBe(row0.spans[2]!.text);
	expect(row1.spans[3]!.text).toBe(row0.spans[3]!.text);

	// A second jump on another position reaches row 2.
	await pin(page, 2);
	await pick(page);
	await expect(page.getByTestId('t-max')).toHaveText('2');
	const row2 = (await readProse(page))!;
	expect(row2.spans[2]!.text).not.toBe(row1.spans[2]!.text);

	// AC5: undo pops the tail and restores row 1.
	await page.getByRole('button', { name: 'Undo' }).click();
	await expect(page.getByTestId('t-max')).toHaveText('1');
	expect((await readProse(page))!.text).toBe(row1.text);

	// Scrubbing closes the pinned inspector so the branch point and focus
	// agree; the next pin belongs to the visible row.
	await pin(page, 1);
	await page.getByTestId('time-slider').fill('0');
	await expect(page.getByRole('tooltip')).toHaveCount(0);
	await expect(page.locator('.readout')).toContainText('t = 0 / 1');

	// Branch from row 0: the future is replaced, not appended at 3.
	await pin(page, 2);
	await pick(page);
	await expect(page.locator('.readout')).toContainText('t = 1 / 1');
	const branch = (await readProse(page))!;
	expect(branch.text).not.toBe(row1.text);
	expect(branch.text).not.toBe(row2.text);
	expect(branch.spans[0]!.text).toBe(row0.spans[0]!.text);
	expect(branch.spans[1]!.text).toBe(row0.spans[1]!.text);
	expect(branch.spans[2]!.text).not.toBe(row0.spans[2]!.text);
	expect(branch.spans[3]!.text).toBe(row0.spans[3]!.text);

	expect(errors).toEqual([]);
});
