import { expect, test } from '@playwright/test';

/**
 * These three tests were written against a ranked `.result-table` of
 * `.result-row`s. That display was deliberately replaced by paired
 * `.butterfly` comparisons -- one figure per competitor, a baseline half and a
 * competitor half -- so the old selectors describe markup that no longer
 * exists. They assert the same PROPERTIES against the new display: the run
 * completes, every checked arm reports, nothing overflows at mobile or tablet
 * width, and the comparison bars stay inside their figure.
 */

/** One baseline half plus one competitor half per comparison. */
const COMPARISONS = 7;
const WORKLOADS = 3;

const horizontalOverflow = (page: import('@playwright/test').Page) =>
  page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth
  );

/** Every comparison's bars must stay within the figure that owns them. */
const barsEscapingTheirFigure = (page: import('@playwright/test').Page) =>
  page.evaluate(() =>
    Array.from(document.querySelectorAll('.butterfly')).flatMap((figure) => {
      const bounds = figure.getBoundingClientRect();
      return Array.from(figure.querySelectorAll('.paired-bars, .bar')).flatMap(
        (part) => {
          const box = part.getBoundingClientRect();
          const escapes =
            box.left < bounds.left - 1 || box.right > bounds.right + 1;
          return escapes
            ? [
                {
                  competitor: figure.getAttribute('data-competitor'),
                  cls: part.getAttribute('class'),
                  box: [box.left, box.right],
                  figure: [bounds.left, bounds.right],
                },
              ]
            : [];
        }
      );
    })
  );

const runBenchmarks = async (page: import('@playwright/test').Page) => {
  // Nothing is rendered before a run: `.butterfly` is 0 on a fresh load, so
  // waiting for the full set is a real completion signal rather than a wait
  // that was already satisfied.
  await expect(page.locator('.butterfly')).toHaveCount(0);
  await page.getByRole('button', { name: 'Run benchmarks' }).click();
  await expect(page.locator('.butterfly')).toHaveCount(COMPARISONS, {
    timeout: 60_000,
  });
  await expect(page.locator('.benchmarks-page')).toHaveAttribute(
    'aria-busy',
    'false'
  );
  await expect(page.locator('.run-error')).toHaveCount(0);
  // Every arm reported a median. Guards against a redesign that renders the
  // figures but leaves them empty, which the counts alone would not catch.
  const medians = await page
    .locator('.pair-labels span')
    .evaluateAll((spans) => spans.map((span) => span.textContent?.trim() ?? ''));
  expect(medians).toHaveLength(COMPARISONS * 2);
  expect(medians.every((text) => /ms$/.test(text))).toBe(true);
};

test('v15 browser spot-check completes every checked arm', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/benchmarks', { waitUntil: 'load' });
  await expect(
    page.getByRole('heading', { name: 'Compare the work your app does.' })
  ).toBeVisible();
  await expect(page.locator('.build-notice')).toHaveCount(0);

  // --- run controls -------------------------------------------------------
  const measuredRounds = page.locator('#measured-rounds');
  const runButton = page.getByRole('button', { name: 'Run benchmarks' });
  await expect(measuredRounds).toHaveValue('25');
  await expect(page.locator('.benchmarks-page')).toHaveAttribute(
    'data-measured-rounds',
    '25'
  );
  await measuredRounds.fill('37');
  await expect(runButton).toBeEnabled();
  await expect(page.locator('.benchmarks-page')).toHaveAttribute(
    'data-measured-rounds',
    '37'
  );
  await measuredRounds.fill('0');
  await expect(measuredRounds).toHaveAttribute('aria-invalid', 'true');
  await expect(runButton).toBeDisabled();

  // Depth is chosen by two aria-pressed buttons; each restores its own rounds.
  const steady = page.getByRole('button', { name: 'Steady', exact: true });
  const quick = page.getByRole('button', { name: 'Quick', exact: true });
  await steady.click();
  await expect(measuredRounds).toHaveValue('100');
  await expect(steady).toHaveAttribute('aria-pressed', 'true');
  await quick.click();
  await expect(measuredRounds).toHaveValue('25');
  await expect(quick).toHaveAttribute('aria-pressed', 'true');

  // --- the run ------------------------------------------------------------
  await runBenchmarks(page);
  await expect(page.locator('.workload')).toHaveCount(WORKLOADS);
  await expect(page.locator('.chart-key')).toHaveCount(WORKLOADS);
  await expect(page.locator('.paired-bars')).toHaveCount(COMPARISONS);
  await expect(page.locator('.bar-half')).toHaveCount(COMPARISONS * 2);
  await expect(page.locator('.bar')).toHaveCount(COMPARISONS * 2);
  await expect(page.locator('.development-badge')).toHaveCount(0);

  // Every checked arm reported, and the baseline appears in each comparison.
  for (const [label, count] of Object.entries({
    'SignalTree Angular': COMPARISONS,
    'NgRx Signals': 2,
    Akita: 3,
    'Redux Toolkit': 2,
  })) {
    await expect(
      page.locator('.pair-labels strong', { hasText: label })
    ).toHaveCount(count);
  }

  // Each workload still discloses what it measured and who qualified.
  await expect(
    page.locator('summary', { hasText: 'Exact results and implementation' })
  ).toHaveCount(WORKLOADS);
  await expect(
    page.locator('summary', { hasText: 'What is measured and which libraries' })
  ).toHaveCount(WORKLOADS);
  await expect(page.locator('.capability-admission')).toHaveCount(WORKLOADS);
  // Plain locators, not getByRole: these headings live inside the collapsed
  // `.capability-admission` details, so they are absent from the
  // accessibility tree until the reader opens it.
  await expect(
    page.locator('.capability-admission h3', {
      hasText: 'First-party keyed entity state',
    })
  ).toHaveCount(2);
  await expect(
    page.locator('.capability-admission h3', {
      hasText: 'First-party linear undo over keyed state',
    })
  ).toHaveCount(1);

  // --- claims that were withdrawn must not come back ----------------------
  await expect(page.locator('body')).not.toContainText(/\bElf\b/i);
  await expect(page.getByText('Raw Angular', { exact: false })).toHaveCount(0);
  await expect(page.getByText('One-time cost', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Ongoing cost', { exact: true })).toHaveCount(0);
  await expect(page.getByText(/crossover/i)).toHaveCount(0);
  await expect(page.getByText(/lifetime advantage/i)).toHaveCount(0);
  await expect(page.locator('[data-workload-id="initialization"]')).toHaveCount(
    0
  );
  await expect(page.locator('.value-proposition')).toHaveCount(0);

  expect(await horizontalOverflow(page)).toBe(0);
  expect(await barsEscapingTheirFigure(page)).toEqual([]);
});

test('paired comparisons stack without overflow on mobile', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/benchmarks', { waitUntil: 'load' });
  await runBenchmarks(page);

  expect(await horizontalOverflow(page)).toBe(0);
  expect(await barsEscapingTheirFigure(page)).toEqual([]);

  // The halves stack rather than sitting side by side at this width, and the
  // figure still fits the viewport's content box.
  const figure = page.locator('.butterfly').first();
  const box = await figure.boundingBox();
  expect(box?.width).toBeLessThanOrEqual(390);
  expect(box?.width).toBeGreaterThan(150);

  // Bars stay measurable rather than collapsing to nothing.
  const widths = await page
    .locator('.butterfly')
    .first()
    .locator('.bar')
    .evaluateAll((bars) =>
      bars.map((bar) => bar.getBoundingClientRect().width)
    );
  expect(widths).toHaveLength(2);
  expect(Math.max(...widths)).toBeGreaterThan(0);
});

test('paired comparisons retain their bars at the tablet breakpoint', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 768, height: 900 });
  await page.goto('/benchmarks', { waitUntil: 'load' });
  await runBenchmarks(page);

  expect(await horizontalOverflow(page)).toBe(0);
  expect(await barsEscapingTheirFigure(page)).toEqual([]);

  const figure = page.locator('.butterfly').first();
  const figureBox = await figure.boundingBox();
  expect(figureBox?.width).toBeGreaterThan(250);
  expect(figureBox?.width).toBeLessThanOrEqual(768);

  const track = await figure.locator('.paired-bars').boundingBox();
  expect(track?.width).toBeGreaterThan(250);
});

for (const legacyPath of ['/benchmark', '/realistic-comparison']) {
  test(`${legacyPath} converges on the v15 benchmark`, async ({ page }) => {
    await page.goto(legacyPath, { waitUntil: 'load' });

    await expect(page).toHaveURL(/\/benchmarks$/);
    await expect(
      page.getByRole('heading', {
        name: 'Compare the work your app does.',
      })
    ).toBeVisible();
  });
}
