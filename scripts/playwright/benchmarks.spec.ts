import { expect, test } from '@playwright/test';

test('v15 browser spot-check completes every checked arm', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/benchmarks', { waitUntil: 'load' });
  await expect(
    page.getByRole('heading', { name: 'Browser performance spot-check' })
  ).toBeVisible();
  await expect(page.locator('.build-notice')).toHaveCount(0);

  await page.getByRole('button', { name: 'Run browser spot-check' }).click();
  await expect(page.locator('.result-row')).toHaveCount(16, {
    timeout: 30_000,
  });

  await expect(page.locator('.run-error')).toHaveCount(0);
  await expect(page.locator('.benchmarks-page')).toHaveAttribute(
    'aria-busy',
    'false'
  );
  await expect(page.locator('.result-table')).toHaveCount(3);
  await expect(page.locator('.development-badge')).toHaveCount(0);
  await expect(page.locator('.range-label')).toHaveCount(16);
  await expect(page.locator('.result-visual-track')).toHaveCount(16);
  await expect(page.locator('.result-row .comparison-kind')).toHaveCount(16);
  await expect(page.locator('.comparison-command')).toHaveCount(16);
  await expect(page.locator('.phase-breakdown')).toHaveCount(4);
  await expect(
    page.locator('.result-row .comparison-kind', { hasText: 'Harness' })
  ).toHaveCount(0);
  await expect(page.locator('.spread')).toHaveCount(0);

  await expect(
    page.getByRole('heading', { name: 'How each result is calculated' })
  ).toBeVisible();

  for (const workload of await page.locator('.workload').all()) {
    const rows = workload.locator('.result-row');
    const medians = await rows.evaluateAll((elements) =>
      elements.map((element) => Number(element.getAttribute('data-median-ms')))
    );
    expect(medians).toEqual([...medians].sort((left, right) => left - right));
    expect(
      await rows.evaluateAll((elements) =>
        elements.map((element) => Number(element.getAttribute('data-rank')))
      )
    ).toEqual(
      Array.from({ length: await rows.count() }, (_, index) => index + 1)
    );
  }

  for (const [expected, count] of Object.entries({
    'SignalTree Angular': 3,
    'SignalTree Kernel': 3,
    'NgRx Signals': 2,
    Elf: 3,
    Akita: 3,
    'Redux Toolkit': 2,
  })) {
    await expect(
      page.locator('.result-row .implementation strong', {
        hasText: expected,
      })
    ).toHaveCount(count);
  }

  await expect(page.locator('.capability-admission')).toHaveCount(3);
  await expect(
    page.getByRole('heading', { name: 'First-party keyed entity state' })
  ).toHaveCount(2);
  await expect(
    page.getByRole('heading', {
      name: 'First-party linear undo over keyed state',
    })
  ).toHaveCount(1);

  await expect(page.getByText('One-time cost', { exact: true })).toBeVisible();
  await expect(page.getByText('Ongoing cost', { exact: true })).toBeVisible();
  await expect(page.getByText('Raw Angular', { exact: false })).toHaveCount(0);

  const restorationProvenance = {
    'signaltree-angular': 'Built-in history',
    'signaltree-kernel': 'Built-in history',
    elf: 'First-party history add-on',
    akita: 'First-party history add-on',
  };
  for (const [armId, provenance] of Object.entries(restorationProvenance)) {
    await expect(
      page.locator(
        `[data-workload-id="restoration"] [data-arm-id="${armId}"] .comparison-kind`
      )
    ).toHaveText(provenance);
  }

  const comparisonTrigger = page.locator(
    '[data-workload-id="restoration"] [data-arm-id="elf"] .comparison-command'
  );
  await comparisonTrigger.click();
  const comparisonDialog = page.locator('.comparison-dialog');
  await expect(comparisonDialog).toBeVisible();
  await expect(comparisonDialog).toContainText('First-party history add-on');
  await expect(comparisonDialog).toContainText(
    'installs @ngneat/elf-state-history on the real Elf entity store'
  );
  await page.keyboard.press('Escape');
  await expect(comparisonDialog).not.toBeVisible();
  await expect(comparisonTrigger).toBeFocused();

  await comparisonTrigger.click();
  await comparisonDialog.getByRole('button', { name: 'Close' }).click();
  await expect(comparisonDialog).not.toBeVisible();

  expect(
    await page
      .locator('.result-row')
      .first()
      .evaluate(
        (element) =>
          getComputedStyle(element).gridTemplateColumns.split(' ').length
      )
  ).toBe(5);

  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth
    )
  ).toBe(0);
});

test('ranked result displays stack without overflow on mobile', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/benchmarks', { waitUntil: 'load' });
  await page.getByRole('button', { name: 'Run browser spot-check' }).click();
  await expect(page.locator('.result-row')).toHaveCount(16, {
    timeout: 30_000,
  });

  const firstRow = page.locator('.result-row').first();
  expect(
    await firstRow.evaluate(
      (element) =>
        getComputedStyle(element).gridTemplateColumns.split(' ').length
    )
  ).toBe(2);
  expect(
    (await firstRow.locator('.result-visual-track').boundingBox())?.width
  ).toBeGreaterThan(150);
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth
    )
  ).toBe(0);

  await page.locator('.comparison-command').first().click();
  const dialog = page.locator('.comparison-dialog');
  await expect(dialog).toBeVisible();
  const dialogBox = await dialog.boundingBox();
  expect(dialogBox?.width).toBeLessThanOrEqual(374);
  expect(dialogBox?.height).toBeLessThanOrEqual(828);
});

test('ranked result displays retain visual tracks at the tablet breakpoint', async ({
  page,
}) => {
  await page.setViewportSize({ width: 768, height: 900 });
  await page.goto('/benchmarks', { waitUntil: 'load' });
  await page.getByRole('button', { name: 'Run browser spot-check' }).click();
  await expect(page.locator('.result-row')).toHaveCount(16, {
    timeout: 30_000,
  });

  const firstRow = page.locator('.result-row').first();
  expect(
    await firstRow.evaluate(
      (element) =>
        getComputedStyle(element).gridTemplateColumns.split(' ').length
    )
  ).toBe(3);
  expect(
    (await firstRow.locator('.result-visual-track').boundingBox())?.width
  ).toBeGreaterThan(250);
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth
    )
  ).toBe(0);
});

for (const legacyPath of ['/benchmark', '/realistic-comparison']) {
  test(`${legacyPath} converges on the v15 benchmark`, async ({ page }) => {
    await page.goto(legacyPath, { waitUntil: 'load' });

    await expect(page).toHaveURL(/\/benchmarks$/);
    await expect(
      page.getByRole('heading', { name: 'Browser performance spot-check' })
    ).toBeVisible();
  });
}
