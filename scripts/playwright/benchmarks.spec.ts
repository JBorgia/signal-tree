import { expect, test } from '@playwright/test';

test('v15 browser spot-check completes every checked arm', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/benchmarks', { waitUntil: 'load' });
  await expect(
    page.getByRole('heading', {
      name: 'Recurring application-state performance',
    })
  ).toBeVisible();
  await expect(page.locator('.build-notice')).toHaveCount(0);

  await page.getByRole('button', { name: 'Run recurring spot-check' }).click();
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
  await expect(page.locator('.implementation-source-links a')).toHaveCount(16);
  await expect(page.locator('.evidence-line a')).toHaveCount(9);
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
  await expect(page.getByText('@ngrx/signals 21.1.1')).toHaveCount(2);
  await expect(page.getByText('@reduxjs/toolkit 2.12.0')).toHaveCount(2);
  await expect(page.getByText('@ngneat/elf-state-history 1.4.0')).toHaveCount(
    1
  );

  await expect(page.getByText('One-time cost', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Ongoing cost', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Raw Angular', { exact: false })).toHaveCount(0);
  await expect(page.locator('[data-workload-id="initialization"]')).toHaveCount(
    0
  );
  await expect(page.locator('.value-proposition')).toHaveCount(0);
  await expect(page.getByText(/crossover/i)).toHaveCount(0);
  await expect(page.getByText(/lifetime advantage/i)).toHaveCount(0);

  const profileRows = page.locator('.steady-state-row');
  await expect(profileRows).toHaveCount(3);
  await expect(
    page.getByRole('heading', {
      name: 'What compounds after construction',
    })
  ).toBeVisible();
  await expect(
    page.getByRole('heading', {
      name: 'What must survive underneath the numbers',
    })
  ).toBeVisible();
  await expect(page.locator('.performance-priorities section')).toHaveCount(3);
  await expect(page.locator('.construction-budget')).toContainText(
    'Initialization is a budget, not an optimization target'
  );
  await expect(page.locator('.projection-condition')).toContainText(
    'No workload is pooled into an aggregate score'
  );
  await expect(page.locator('.foundation-grid article')).toHaveCount(4);
  await expect(page.locator('.foundation-evidence a')).toHaveCount(15);
  await expect(page.locator('.foundation-ledger')).toContainText(
    'Typed dot notation survives representation changes'
  );
  await expect(page.locator('.foundation-ledger')).toContainText(
    'Measured; not globally optimal'
  );
  await expect(page.locator('.foundation-ledger')).toContainText(
    'Measured; not proven optimal'
  );
  await expect(page.locator('.foundation-ledger')).toContainText(
    'Optimistic and causal work avoids a future state-model rewrite'
  );
  await expect(page.locator('.foundation-verdict')).toContainText(
    'Speed and density are measured independently'
  );
  await expect(page.locator('.foundation-ledger')).toContainText(
    'tools/bench-capability-density.mjs'
  );
  await expect(page.locator('.foundation-ledger')).toContainText(
    'tools/bench-update-matrix.mjs'
  );
  for (const row of await profileRows.all()) {
    const values = await row.evaluate((element) => ({
      measured: Number(element.getAttribute('data-measured-median-ms')),
      operations: Number(element.getAttribute('data-measured-operations')),
      perThousand: Number(element.getAttribute('data-per-thousand-ms')),
      perTenThousand: Number(element.getAttribute('data-per-ten-thousand-ms')),
      perHundredThousand: Number(
        element.getAttribute('data-per-hundred-thousand-ms')
      ),
      position: Number(element.getAttribute('data-position')),
      cohortSize: Number(element.getAttribute('data-cohort-size')),
    }));
    expect(Number.isFinite(values.measured)).toBe(true);
    expect(values.operations).toBeGreaterThan(0);
    expect(values.perThousand).toBeCloseTo(
      (values.measured / values.operations) * 1_000,
      8
    );
    expect(values.perTenThousand).toBeCloseTo(values.perThousand * 10, 8);
    expect(values.perHundredThousand).toBeCloseTo(values.perThousand * 100, 8);
    expect(values.position).toBeGreaterThanOrEqual(1);
    expect(values.position).toBeLessThanOrEqual(values.cohortSize);
  }
  for (const selector of [
    '.steady-state-heading h2',
    '.steady-state-row > strong',
    '.steady-state-row > span strong',
  ]) {
    const contrastRatio = await page
      .locator(selector)
      .first()
      .evaluate((element) => {
        const parse = (color: string): [number, number, number, number] => {
          const parts = color.match(/[\d.]+/g)?.map(Number) ?? [];
          return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0, parts[3] ?? 1];
        };
        const luminance = ([red, green, blue]: readonly number[]): number => {
          const channels = [red, green, blue].map((channel) => {
            const normalized = channel / 255;
            return normalized <= 0.04045
              ? normalized / 12.92
              : ((normalized + 0.055) / 1.055) ** 2.4;
          });
          return (
            0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
          );
        };
        const foreground = parse(getComputedStyle(element).color);
        let surface: Element | null = element.parentElement;
        while (
          surface &&
          parse(getComputedStyle(surface).backgroundColor)[3] === 0
        ) {
          surface = surface.parentElement;
        }
        const background = parse(
          surface
            ? getComputedStyle(surface).backgroundColor
            : 'rgb(255, 255, 255)'
        );
        const lighter = Math.max(luminance(foreground), luminance(background));
        const darker = Math.min(luminance(foreground), luminance(background));
        return (lighter + 0.05) / (darker + 0.05);
      });
    expect(contrastRatio).toBeGreaterThanOrEqual(4.5);
  }

  const kernelCollectionMedian = Number(
    await page
      .locator(
        '[data-workload-id="collection"] [data-arm-id="signaltree-kernel"]'
      )
      .getAttribute('data-median-ms')
  );
  await page.getByRole('button', { name: 'Kernel realization' }).click();
  await expect(page.locator('.steady-state-value')).toHaveAttribute(
    'data-profile-arm-id',
    'signaltree-kernel'
  );
  expect(
    Number(
      await page
        .locator('[data-profile-workload="collection"]')
        .getAttribute('data-measured-median-ms')
    )
  ).toBe(kernelCollectionMedian);

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
    '@ngneat/elf-state-history 1.4.0'
  );
  await expect(
    comparisonDialog.getByRole('link', {
      name: 'Elf state-history 1.4.0 implementation',
    })
  ).toHaveAttribute('href', /unpkg\.com\/.*elf-state-history/);
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
  await page.getByRole('button', { name: 'Run recurring spot-check' }).click();
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

  expect(
    await page
      .locator('.steady-state-row')
      .first()
      .evaluate(
        (element) =>
          getComputedStyle(element).gridTemplateColumns.split(' ').length
      )
  ).toBe(1);
  expect(
    (await page.locator('.profile-realization').boundingBox())?.width
  ).toBeLessThanOrEqual(358);
});

test('ranked result displays retain visual tracks at the tablet breakpoint', async ({
  page,
}) => {
  await page.setViewportSize({ width: 768, height: 900 });
  await page.goto('/benchmarks', { waitUntil: 'load' });
  await page.getByRole('button', { name: 'Run recurring spot-check' }).click();
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
    await page
      .locator('.steady-state-row')
      .first()
      .evaluate(
        (element) =>
          getComputedStyle(element).gridTemplateColumns.split(' ').length
      )
  ).toBe(2);
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
      page.getByRole('heading', {
        name: 'Recurring application-state performance',
      })
    ).toBeVisible();
  });
}
