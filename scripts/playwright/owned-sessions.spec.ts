import { expect, test } from '@playwright/test';

test('independent drafts refuse stale saves and do not retarget replaced records', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/owned-sessions');
  await expect(
    page.getByRole('heading', { name: 'One session. One owner.' })
  ).toBeVisible();
  await page.getByRole('button', { name: 'Open editor', exact: true }).click();
  await page.getByRole('button', { name: 'Open editor', exact: true }).click();
  const first = page.getByRole('article', { name: 'Editor 1', exact: true });
  const second = page.getByRole('article', { name: 'Editor 2', exact: true });
  await first.getByLabel('Draft title').fill('First draft');
  await second.getByLabel('Draft title').fill('Second draft');
  await expect(page.getByTestId('canonical-title')).toHaveText(
    'Inspect delivery'
  );
  await first.getByRole('button', { name: 'Apply locally' }).click();
  await expect(first).toHaveCount(0);
  await expect(page.getByTestId('canonical-title')).toHaveText('First draft');
  await second.getByRole('button', { name: 'Apply locally' }).click();
  await expect(second.getByRole('status')).toContainText(
    'Current data changed'
  );
  await expect(second.getByLabel('Draft title')).toHaveValue('Second draft');
  await second
    .getByRole('button', { name: 'Discard edits and reload' })
    .click();
  await expect(second.getByLabel('Draft title')).toHaveValue('First draft');
  await page.getByRole('button', { name: 'Simulate server update' }).click();
  await second.getByRole('button', { name: 'Apply locally' }).click();
  await expect(second.getByRole('status')).toContainText(
    'Current data changed'
  );
  await expect(page.getByTestId('canonical-title')).toHaveText(
    'Server update 3'
  );
  await page
    .getByRole('button', { name: 'Replace record with same ID' })
    .click();
  await second.getByRole('button', { name: 'Apply locally' }).click();
  await expect(second.getByRole('status')).toContainText(
    'This record was replaced'
  );
  await expect(page.getByTestId('canonical-title')).toHaveText(
    'Replacement record'
  );
  await second.getByRole('button', { name: 'Close and discard' }).click();
  await expect(second).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('device timers stop independently and route teardown removes remaining timers', async ({
  page,
}) => {
  // Count live intervals without a production debug API. Angular navigation
  // stays in the same document, so leaving the route must release its timers.
  await page.addInitScript(() => {
    const state = window as unknown as { sessionIntervals: Set<number> };
    state.sessionIntervals = new Set();
    const start = window.setInterval.bind(window);
    const stop = window.clearInterval.bind(window);
    window.setInterval = ((...args: Parameters<typeof window.setInterval>) => {
      const id = start(...args);
      state.sessionIntervals.add(id);
      return id;
    }) as typeof window.setInterval;
    window.clearInterval = (id?: number) => {
      state.sessionIntervals.delete(id as number);
      stop(id);
    };
  });
  await page.goto('/owned-sessions');
  await expect(
    page.getByRole('heading', { name: 'One session. One owner.' })
  ).toBeVisible();
  const count = () =>
    page.evaluate(
      () =>
        (window as unknown as { sessionIntervals: Set<number> })
          .sessionIntervals.size
    );
  const initial = await count();
  await page.getByRole('button', { name: 'Start simulated device' }).click();
  await page.getByRole('button', { name: 'Start simulated device' }).click();
  await expect.poll(count).toBe(initial + 2);
  await expect(page.getByTestId('sample-total')).not.toHaveText(
    'Samples in active sessions: 0'
  );
  await page
    .getByRole('button', { name: 'Stop Device 1', exact: true })
    .click();
  await expect.poll(count).toBe(initial + 1);
  const remaining = page.getByRole('article', {
    name: 'Device 2',
    exact: true,
  });
  const before = await remaining.innerText();
  await expect.poll(() => remaining.innerText()).not.toBe(before);
  await page
    .getByRole('link', { name: 'Read the implementation guide' })
    .click();
  await expect(page).toHaveURL(/docs\?package=owned-sessions/);
  await expect(page.locator('.markdown-content h1')).toHaveText(
    'Independent editors and device sessions'
  );
  await expect.poll(count).toBe(initial);
});

test('ownership example stays readable on mobile and serves current AI guidance', async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/owned-sessions');
  await page.getByRole('button', { name: 'Open editor', exact: true }).click();
  await expect(
    page.getByRole('article', { name: 'Editor 1', exact: true })
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth
    )
  ).toBe(true);
  const guide = await request.get('/assets/docs/guides/owned-sessions.md');
  expect(guide.ok()).toBe(true);
  expect(await guide.text()).toContain('must be enforced by the backend');
  const ai = await request.get('/llms.txt');
  expect(await ai.text()).toContain(
    '## Choosing ownership for editors and devices'
  );
  await page.screenshot({
    path: '/tmp/st-owned-sessions-mobile.png',
    fullPage: true,
  });
});
