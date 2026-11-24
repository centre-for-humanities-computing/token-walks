// The embedding source picker must let the user choose GPT-2 while the word
// tokenizer is active, then switch back to GloVe.
import { expect, test } from '@playwright/test';

const TIMEOUT = 120_000;

test('embedding source: GPT-2 wins over the word-tokenizer default', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByTestId('tokenizer-gpt2')).toHaveAttribute('aria-checked', 'true', {
		timeout: TIMEOUT,
	});

	const strategy = page.getByTestId('strategy-embedding-knn');
	await expect(strategy).toBeEnabled({ timeout: TIMEOUT });
	await strategy.click();
	await expect(strategy).toHaveAttribute('aria-checked', 'true');

	// GloVe pairs with the word tokenizer, so selecting it loads that tokenizer.
	const glove = page.getByTestId('embedding-source-glove-840b-300d');
	const gpt2 = page.getByTestId('embedding-source-gpt2');
	await expect(glove).toBeEnabled({ timeout: TIMEOUT });
	await glove.click();
	await expect(glove).toHaveAttribute('aria-checked', 'true');
	await expect(page.getByTestId('tokenizer-words')).toHaveAttribute('aria-checked', 'true', {
		timeout: TIMEOUT,
	});
	await expect(glove).toBeEnabled({ timeout: TIMEOUT });

	// A user click on GPT-2 must not be overwritten by the word-tokenizer
	// default effect.
	await gpt2.click();
	await expect(gpt2).toHaveAttribute('aria-checked', 'true');
	await expect(page.getByTestId('tokenizer-gpt2')).toHaveAttribute('aria-checked', 'true', {
		timeout: TIMEOUT,
	});

	// Switching back to GloVe still works.
	await expect(glove).toBeEnabled({ timeout: TIMEOUT });
	await glove.click();
	await expect(glove).toHaveAttribute('aria-checked', 'true');
	await expect(page.getByTestId('tokenizer-words')).toHaveAttribute('aria-checked', 'true', {
		timeout: TIMEOUT,
	});
});
