import { expect, test } from '@playwright/test';

for (const viewport of [
  { width: 1280, height: 900 },
  { width: 390, height: 844 },
]) {
  test(`order story explains actual work and links to the checked recipe at ${viewport.width}px`, async ({
    page,
    request,
  }) => {
    await page.setViewportSize(viewport);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/');
    await expect(
      page.getByRole('heading', {
        name: 'Update one field. Keep the rest intact.',
      })
    ).toBeVisible();
    const order = page.locator('[data-order="101"]');
    const other = page.locator('[data-order="102"]');
    await page.getByRole('button', { name: '1. Make it Rush' }).click();
    await expect(order.locator('[data-priority]')).toHaveText('Rush');
    await page
      .getByRole('button', { name: '2. Receive server update' })
      .click();
    await expect(order.locator('[data-status]')).toHaveText('Shipped');
    await page.getByRole('button', { name: '3. Undo my edit' }).click();
    await expect(order.locator('[data-priority]')).toHaveText('Standard');
    await expect(order.locator('[data-status]')).toHaveText('Shipped');
    await expect(other.locator('[data-priority]')).toHaveText('Standard');
    await expect(other.locator('[data-status]')).toHaveText('Ready');
    await expect(page.locator('.story-history li')).toHaveCount(3);
    await expect(page.locator('.story-history li').last()).toContainText(
      'Shipping status stayed Shipped'
    );

    await page.getByRole('button', { name: 'I choose the product' }).click();
    await expect(page.locator('.perspective-copy')).toContainText(
      'potential benefits to measure'
    );
    await page.getByRole('button', { name: 'I build the app' }).click();
    await expect(page.locator('.perspective-copy')).toContainText(
      'component owns this store'
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth
      )
    ).toBe(true);
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    await page.screenshot({
      path: `artifacts/v15-adoption-story/home-${viewport.width}.png`,
      fullPage: true,
    });
    await page
      .getByRole('link', { name: 'Build this feature from the checked recipe' })
      .click();
    await expect(page).toHaveURL(/docs\?package=first-feature-v15/);
    await expect(page.locator('.markdown-content h1')).toHaveText(
      'Your first v15 feature: edit while updates arrive'
    );
    await expect(page.locator('.markdown-content')).toContainText(
      'The backend owns authorization'
    );
    const readGuide = page.getByRole('link', {
      name: 'Read First v15 Feature',
    });
    await expect(readGuide).toBeVisible();
    await readGuide.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#selected-guide')).toBeFocused();
    await expect
      .poll(() =>
        page.locator('#selected-guide').evaluate((element) => {
          const top = element.getBoundingClientRect().top;
          return top >= 64 && top < window.innerHeight;
        })
      )
      .toBe(true);
    expect(new URL(page.url()).searchParams.get('package')).toBe(
      'first-feature-v15'
    );
    await expect(
      page.getByRole('link', { name: 'order-tree recipe', exact: true })
    ).toHaveAttribute('href', /blob\/[a-f0-9]{40}\/apps\/demo/);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth
      )
    ).toBe(true);
    await page.screenshot({
      path: `artifacts/v15-adoption-story/recipe-${viewport.width}.png`,
      fullPage: true,
    });
    await page.goto('/start');
    await expect(
      page.getByRole('heading', { name: 'Try one feature first.' })
    ).toBeVisible();
    const recipeLink = page.getByRole('link', {
      name: 'checked first-feature recipe',
      exact: true,
    });
    await expect(recipeLink).toHaveAttribute(
      'href',
      '/docs?package=first-feature-v15'
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth
      )
    ).toBe(true);
    await page.screenshot({
      path: `artifacts/v15-adoption-story/start-${viewport.width}.png`,
      fullPage: true,
    });
    await recipeLink.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.markdown-content h1')).toHaveText(
      'Your first v15 feature: edit while updates arrive'
    );
    const ai = await request.get('/llms.txt');
    expect(ai.ok()).toBe(true);
    const guidance = await ai.text();
    expect(guidance).toContain('## Adopt one useful feature');
    expect(guidance).toContain('V15 opens transactions with `transaction()`');
    expect(guidance).not.toContain(
      'This reference describes the 15.4.3 package version'
    );
    expect(errors).toEqual([]);
  });
}
