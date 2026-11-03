import { expect, test } from '@playwright/test';

test('inventory CRUD, derived queries, held references and route teardown', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/entities');
  const rows = page.locator('.entity-row');
  await expect(rows).toHaveCount(4);
  await page.getByRole('button', { name: 'Update through the map', exact: true }).click();
  await expect(page.locator('.held-inspection output')).toHaveText('Desk lamp, revised');
  await expect(rows.first()).toContainText('Desk lamp, revised');
  await page.getByLabel('Add one record').fill('  Candidate shipment  ');
  await page.getByRole('button', { name: 'Add product', exact: true }).click();
  await expect(rows).toHaveCount(5);
  const shipment = rows.filter({ hasText: 'Candidate shipment' });
  await expect(shipment).toContainText('NEW-005');
  await expect(page.locator('.event-output')).toContainText('Added Candidate shipment after commit (5 total)');
  for (let i = 0; i < 10; i++) {
    await shipment.getByRole('button', { name: 'Reserve', exact: true }).click();
    await expect(shipment.locator('.availability')).toHaveText('reserved');
    await shipment.getByRole('button', { name: 'Release', exact: true }).click();
    await expect(shipment.locator('.availability')).toHaveText('available');
  }
  await shipment.getByRole('button', { name: 'Reserve', exact: true }).click();
  await page.getByRole('group', { name: 'Filter products' }).getByRole('button', { name: 'Reserved', exact: true }).click();
  await expect(rows).toHaveCount(2);
  await shipment.getByRole('button', { name: 'Remove', exact: true }).click();
  await expect(rows).toHaveCount(1);
  await page.getByRole('button', { name: 'Attempt a blank-name add', exact: true }).click();
  await expect(page.locator('.blocked-output')).toContainText('Rejected before commit');
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

test('independent publication settles while proposal remains pending, then rollback and confirmation work', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
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
