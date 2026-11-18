import { expect, test } from '@playwright/test';

test('inventory CRUD, derived queries, held references and route teardown', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/entities');
  const rows = page.locator('.entity-row');
  await expect(rows).toHaveCount(4);
  await page
    .getByRole('button', { name: 'Update through the map', exact: true })
    .click();
  await expect(page.locator('.held-inspection output')).toHaveText(
    'Desk lamp, revised'
  );
  await expect(rows.first()).toContainText('Desk lamp, revised');
  await page.getByLabel('Add one record').fill('  Candidate shipment  ');
  await page.getByRole('button', { name: 'Add product', exact: true }).click();
  await expect(rows).toHaveCount(5);
  const shipment = rows.filter({ hasText: 'Candidate shipment' });
  await expect(shipment).toContainText('NEW-005');
  await expect(page.locator('.event-output')).toContainText(
    'Added Candidate shipment after commit (5 total)'
  );
  for (let i = 0; i < 10; i++) {
    await shipment
      .getByRole('button', { name: 'Reserve', exact: true })
      .click();
    await expect(shipment.locator('.availability')).toHaveText('reserved');
    await shipment
      .getByRole('button', { name: 'Release', exact: true })
      .click();
    await expect(shipment.locator('.availability')).toHaveText('available');
  }
  await shipment.getByRole('button', { name: 'Reserve', exact: true }).click();
  await page
    .getByRole('group', { name: 'Filter products' })
    .getByRole('button', { name: 'Reserved', exact: true })
    .click();
  await expect(rows).toHaveCount(2);
  await shipment.getByRole('button', { name: 'Remove', exact: true }).click();
  await expect(rows).toHaveCount(1);
  await page
    .getByRole('button', { name: 'Attempt a blank-name add', exact: true })
    .click();
  await expect(page.locator('.blocked-output')).toContainText(
    'Rejected before commit'
  );
  await expect(rows).toHaveCount(1);
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(rows).toHaveCount(4);
  await expect(page.locator('.held-inspection output')).toHaveText('Desk lamp');
  // Client routing destroys the component; returning creates a fresh entity lifetime.
  await page.locator('a[href="/independent-publication"]').first().click();
  await expect(page.getByTestId('route')).toHaveText('north');
  await page.locator('a[href="/entities"]').first().click();
  await expect(rows).toHaveCount(4);
  await expect(page.locator('.held-inspection output')).toHaveText('Desk lamp');
  expect(errors).toEqual([]);
});

test('independent publication settles while proposal remains pending, then rollback and confirmation work', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/independent-publication');
  await page.locator('[data-action="propose"]').click();
  await expect(page.getByTestId('route')).toHaveText('west');
  await page.locator('[data-action="publish"]').click();
  await expect(page.getByTestId('endpoint')).toHaveText('dispatch-ready');
  await expect(page.getByTestId('proposal')).toHaveText('Pending local review');
  await expect(page.getByTestId('admission')).toHaveText('started');
  await page.locator('[data-action="reject"]').click();
  await expect(page.getByTestId('route')).toHaveText('north');
  await expect(page.getByTestId('endpoint')).toHaveText('dispatch-ready');
  await page.locator('[data-action="propose"]').click();
  await page.locator('[data-action="confirm"]').click();
  await expect(page.getByTestId('route')).toHaveText('west');
  await expect(page.getByTestId('proposal')).toHaveText('Confirmed locally');
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('overlapping route proposals expose real refusal and preserve unrelated work through recovery', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/independent-publication');
  await page.locator('[data-action="propose"]').click();
  await expect(page.getByTestId('review-change')).toHaveText('route: current');
  await page.locator('[data-action="shipment"]').click();
  await page.locator('[data-action="publish"]').click();
  await expect(page.getByTestId('endpoint')).toHaveText('dispatch-ready');
  await page.locator('[data-action="overlap"]').click();
  await expect(page.getByTestId('review-change')).toHaveText(
    'route: superseded'
  );
  await page.locator('[data-action="reject"]').click();
  await expect(page.getByTestId('proposal')).toHaveText(
    'Still pending · rejection refused'
  );
  await expect(page.getByTestId('route')).toHaveText('east');
  await expect(page.getByTestId('route-endpoint')).toHaveText(
    'No route delivery yet'
  );
  await expect(page.getByTestId('newer-proposal')).toHaveText(
    'Newer proposal pending'
  );
  await page.locator('[data-action="reject-newer"]').click();
  await expect(page.getByTestId('route')).toHaveText('west');
  await page.locator('[data-action="reject"]').click();
  await expect(page.getByTestId('route')).toHaveText('north');
  await expect(page.getByTestId('shipment')).toHaveText('Shipped');
  await expect(page.getByTestId('endpoint')).toHaveText('dispatch-ready');
  await expect(page.getByTestId('recovery')).toHaveText(
    'Review complete; unrelated work remains'
  );
  expect(errors).toEqual([]);
});

test('the lazy architecture tutorial releases its owner and starts fresh on return', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/examples/fundamentals/recommended-architecture');
  await page
    .getByRole('button', { name: 'Toggle theme: light', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Toggle theme: dark', exact: true })
  ).toBeVisible();
  // Learn is already open for this route. Use an actually visible navigation
  // link; Examples may be collapsed, so forcing its hidden link is not a flow.
  await page.getByRole('link', { name: 'Start here', exact: true }).click();
  await expect(page).toHaveURL(/\/start$/);
  await page.goBack();
  await expect(
    page.getByRole('button', { name: 'Toggle theme: light', exact: true })
  ).toBeVisible();
  expect(errors).toEqual([]);
});

for (const width of [1280, 390]) {
  test(`candidate guide is keyboard reachable and version-bound at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/docs?package=adoption-v16');
    await expect(page.locator('.markdown-content h1')).toHaveText(
      'Adopt one v16 workflow'
    );
    const jump = page.getByRole('link', { name: 'Read First v16 Workflow' });
    await expect(jump).toBeVisible();
    await jump.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#selected-guide')).toBeFocused();
    await expect
      .poll(() =>
        page.locator('#selected-guide').evaluate((element) => {
          const top = element.getBoundingClientRect().top;
          return top >= 64 && top < innerHeight;
        })
      )
      .toBe(true);
    expect(new URL(page.url()).searchParams.get('package')).toBe(
      'adoption-v16'
    );
    await expect(
      page.getByRole('link', { name: 'working review story', exact: true })
    ).toHaveAttribute('href', /blob\/[a-f0-9]{40}\/apps\/demo/);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth
      )
    ).toBe(true);
  });
}

for (const [route, fragment] of [
  ['/start', 'feature'],
  ['/migrate', 'operations'],
  ['/architecture-overview', 'accessor-grammar'],
]) {
  test(`keyboard section navigation stays on ${route}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(route);
    const link = page.locator(`a[href="${route}#${fragment}"]`).first();
    await link.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(new RegExp(`${route}#${fragment}$`));
    const target = page.locator(`#${fragment}`);
    await expect(target).toBeFocused();
    await expect
      .poll(async () =>
        target.evaluate((element) => {
          const top = element.getBoundingClientRect().top;
          return top >= 64 && top < innerHeight;
        })
      )
      .toBe(true);
  });
}

test('global skip link keeps the selected document and transfers keyboard focus', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/docs?package=adoption-v16');
  const skip = page.getByRole('link', { name: 'Skip to content', exact: true });
  await skip.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/docs\?package=adoption-v16$/);
  await expect(page.locator('#main-content')).toBeFocused();
  await expect(
    page.getByRole('heading', { name: 'Documentation', exact: true })
  ).toBeVisible();
});

test('a confirmed route needs an explicit idle reset before repeating the refusal story', async ({
  page,
}) => {
  await page.goto('/independent-publication');
  await page.locator('[data-action="propose"]').click();
  await page.locator('[data-action="confirm"]').click();
  await expect(page.getByTestId('route')).toHaveText('west');
  await expect(page.locator('[data-action="propose"]')).toBeDisabled();
  await expect(page.getByTestId('reset-needed')).toContainText(
    'West is already confirmed'
  );
  await page.locator('[data-action="reset"]').click();
  await expect(page.getByTestId('route')).toHaveText('north');
  await page.locator('[data-action="propose"]').click();
  await page.locator('[data-action="shipment"]').click();
  await page.locator('[data-action="publish"]').click();
  await page.locator('[data-action="overlap"]').click();
  await expect(page.locator('[data-action="reset"]')).toBeDisabled();
  await page.locator('[data-action="reject"]').click();
  await expect(page.getByTestId('proposal')).toHaveText(
    'Still pending · rejection refused'
  );
  await expect(page.getByTestId('newer-proposal')).toHaveText(
    'Newer proposal pending'
  );
  await page.locator('[data-action="reject-newer"]').click();
  await page.locator('[data-action="reject"]').click();
  await expect(page.getByTestId('route')).toHaveText('north');
  await expect(page.getByTestId('shipment')).toHaveText('Shipped');
  await expect(page.getByTestId('endpoint')).toHaveText('dispatch-ready');
});
