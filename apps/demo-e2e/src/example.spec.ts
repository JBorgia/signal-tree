import { test, expect } from '@playwright/test';

test('has title', async ({ page }) => {
  await page.goto('/');

  // There may be multiple h1 elements; ensure one contains the demo heading text.
  const headings = await page.locator('h1').allInnerTexts();
  const combined = headings.join(' ');
  expect(combined).toContain('Signal Tree');
});
