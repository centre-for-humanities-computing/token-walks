// Generic smoke test: first load is the one-row hand-walk timeline, and every
// visible registered strategy renders it without errors. `embedding-knn` and
// `wordnet` need remote assets and are skipped until a fixture route exists.
import { expect, test } from '@playwright/test';
import { STRATEGIES } from '../src/lib/strategies/registry';

const NEEDS_FIXTURE = new Set<string>(['embedding-knn', 'wordnet']);
const TOKENIZER_TIMEOUT = 120_000;

const strategies = Object.entries(STRATEGIES).filter(
	([id, info]) => !info.hidden && !NEEDS_FIXTURE.has(id),
);

test('first load opens on the lexical walk with one row', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByTestId('tokenizer-gpt2')).toHaveAttribute('aria-checked', 'true', {
		timeout: TOKENIZER_TIMEOUT,
	});
	const strategy = page.getByTestId('strategy-lexical');
	await expect(strategy).toBeEnabled({ timeout: TOKENIZER_TIMEOUT });
	await expect(strategy).toHaveAttribute('aria-checked', 'true');
	await expect(page.getByTestId('app-status')).toHaveAttribute('data-trajectory-status', 'ready', {
		timeout: TOKENIZER_TIMEOUT,
	});
	await expect(page.getByTestId('t-max')).toHaveText('0');
	await expect(page.getByTestId('noise-button')).toHaveCount(0);
});

for (const [id] of strategies) {
	test(`strategy ${id} renders a one-row timeline`, async ({ page }) => {
		const errors: string[] = [];
		page.on('pageerror', (e) => errors.push(e.message));
		page.on('console', (m) => {
			if (m.type() === 'error') errors.push(m.text());
		});

		await page.goto('/');
		await page.getByRole('button', { name: 'Edit' }).click();
		await page.getByTestId('input-text').fill('The quick brown fox jumps over the lazy dog.');

		const card = page.getByTestId(`strategy-${id}`);
		await expect(card).toBeEnabled({ timeout: TOKENIZER_TIMEOUT });
		await card.click();
		await expect(card).toHaveAttribute('aria-checked', 'true');

		await page.getByTestId('noise-button').click();
		await expect(page.getByTestId('app-status')).toHaveAttribute(
			'data-trajectory-status',
			'ready',
			{
				timeout: TOKENIZER_TIMEOUT,
			},
		);
		await expect(page.getByTestId('t-max')).toHaveText('0');
		await expect(page.getByTestId('output')).not.toBeEmpty();

		expect(errors).toEqual([]);
	});
}
