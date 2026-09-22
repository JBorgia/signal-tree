/**
 * Demo route smoke test (v12 audit intake, 2026-07-24).
 *
 * Visits the key demo routes against a static build and asserts:
 *   1. the requested route actually RESOLVED — the final URL pathname equals
 *      the path we asked for, with NO redirect to home. This is the strict
 *      signal: apps/demo/src/app/app.routes.ts ends in a `**` wildcard that
 *      `redirectTo: ''` (home), so a renamed/removed route silently redirects
 *      to `/` and still renders an <h1>/<main> + returns 200. A plain
 *      "renders something" check therefore passes for a broken route. Asserting
 *      the final pathname catches that.
 *   2. the route renders a visible <h1> or <main> (the SPA actually booted and
 *      the lazy route chunk resolved), and
 *   3. no console errors / uncaught page errors fired.
 *
 * Routes mirror apps/demo/src/app/app.routes.ts — update BOTH when a route in
 * this list is renamed. Every entry here MUST be a real (non-redirect) path;
 * redirect aliases (e.g. /architecture, /rxmethod) would fail the pathname
 * assertion by design.
 */
import { expect, test } from '@playwright/test';

import { DEMO_ROUTES } from './demo-routes';

// Noise that is not a product bug and would make the gate flaky.
const IGNORED_ERROR_PATTERNS = [/favicon/i];

/** Normalize a URL/path to a comparable pathname (strip origin, query, hash,
 * and any trailing slash except the root). */
function pathnameOf(urlOrPath: string): string {
  // Accept both absolute URLs (page.url()) and bare paths.
  const path = urlOrPath.startsWith('http')
    ? new URL(urlOrPath).pathname
    : urlOrPath.split(/[?#]/)[0];
  if (path.length > 1 && path.endsWith('/')) return path.slice(0, -1);
  return path;
}

for (const route of DEMO_ROUTES) {
  test(`route ${route} resolves (no redirect) and renders with no console errors`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (
        msg.type() === 'error' &&
        !IGNORED_ERROR_PATTERNS.some((re) => re.test(msg.text()))
      ) {
        errors.push(msg.text());
      }
    });
    page.on('pageerror', (err) => {
      errors.push(`pageerror: ${err.message}`);
    });

    const response = await page.goto(route, { waitUntil: 'load' });
    expect(response, `no response for ${route}`).not.toBeNull();
    expect(response?.status(), `HTTP status for ${route}`).toBeLessThan(400);

    // The SPA booted and the lazy route chunk rendered something real.
    await expect(
      page.locator('h1, main').first(),
      `no visible h1/main on ${route}`
    ).toBeVisible({ timeout: 20_000 });

    // STRICT: the router landed on the exact path we asked for. A removed or
    // renamed route hits the `**` wildcard and redirects to '' (home) — the
    // final pathname would then be '/', not the requested route. Give the
    // client-side redirect a beat to settle before reading the URL.
    await page.waitForTimeout(500);
    const landed = pathnameOf(page.url());
    const expected = pathnameOf(route);
    expect(
      landed,
      `route ${route} redirected to '${landed}' — it was renamed/removed (the ** wildcard sent it home), or the path in this list is stale`
    ).toBe(expected);

    expect(
      errors,
      `console/page errors on ${route}:\n${errors.join('\n')}`
    ).toEqual([]);
  });
}

/**
 * INTERACTION under OnPush.
 *
 * Every demo component moved from `ChangeDetectionStrategy.Eager` to `OnPush`
 * in 14.0.0. Angular 22 renamed the old default to `Eager` and made OnPush the
 * default; `nx migrate` then stamped `Eager` on all 51 components to preserve
 * behaviour, which left the showcase for a fine-grained-reactivity library
 * explicitly opting OUT of fine-grained change detection.
 *
 * The render-only checks above cannot see an OnPush regression: a component
 * whose view never refreshes still renders correctly on first paint. Only
 * clicking something and asserting the DOM CHANGED can. These tests exist
 * specifically to expose that class, and each was verified to be watching a
 * value the click actually moves.
 */
test('/examples/fundamentals/recommended-architecture: ops update nested state', async ({
  page,
}) => {
  await page.goto('/examples/fundamentals/recommended-architecture', {
    waitUntil: 'load',
  });
  const toggle = page.getByRole('button', { name: /Toggle theme:/ });
  await expect(toggle).toContainText('light', { timeout: 20_000 });
  await toggle.click();
  await expect(toggle).toContainText('dark');
});

test('/batching: grouped writes publish once without intermediate observations', async ({
  page,
}) => {
  await page.goto('/batching', { waitUntil: 'load' });

  await page.getByRole('button', { name: 'Run unbatched' }).click();
  await expect(page.locator('.timeline-entry')).toHaveCount(3);
  await expect(
    page.locator('.run-metrics > div').nth(1).locator('dd')
  ).toHaveText('3');
  await expect(
    page.locator('.run-metrics > div').nth(2).locator('dd')
  ).toHaveText('2');

  await page.getByRole('button', { name: 'Run batched' }).click();
  await expect(page.locator('.timeline-entry')).toHaveCount(1);
  await expect(page.locator('.timeline-entry')).toHaveClass(/--coherent/);
  await expect(
    page.locator('.run-metrics > div').nth(1).locator('dd')
  ).toHaveText('1');
  await expect(
    page.locator('.run-metrics > div').nth(2).locator('dd')
  ).toHaveText('0');
});

test('/why-causality: one snapshot reveals distinct identity histories', async ({
  page,
}) => {
  await page.goto('/why-causality', { waitUntil: 'load' });

  await expect(page.locator('.snapshot-line code')).toHaveText(
    'order.status = "approved"'
  );
  await page.getByRole('radio', { name: 'Identity' }).check();
  await expect(page.locator('.snapshot-line code')).toHaveText(
    'queue = [B, A, C]'
  );
  await expect(page.locator('.history-comparison')).toContainText(
    'The same subjects were reordered'
  );
  await expect(page.locator('.history-comparison')).toContainText(
    'Old rows were replaced by lookalikes'
  );
});

test('/why-causality: public incidents keep their counterfactual boundaries', async ({
  page,
}) => {
  await page.goto('/why-causality#incident-ledger', { waitUntil: 'load' });

  await expect(page.locator('.incident-story')).toHaveCount(3);
  await expect(page.locator('.incident-disclaimer')).toContainText(
    'Counterfactuals, not attribution.'
  );
  await expect(page.locator('.incident-story__scale')).toContainText([
    '$460M loss in 45 minutes',
    '$1.8B loan · unintended early repayment',
    '43 seconds → 24h 11m degradation',
  ]);
  const sourceLinks = page.locator('.incident-story a');
  await expect(sourceLinks).toHaveCount(3);
  await expect(
    sourceLinks.evaluateAll((links) =>
      links.map((link) => ({
        href: link.getAttribute('href'),
        target: link.getAttribute('target'),
        rel: link.getAttribute('rel'),
      }))
    )
  ).resolves.toEqual([
    {
      href: 'https://www.sec.gov/newsroom/press-releases/2013-222',
      target: '_blank',
      rel: 'noopener noreferrer',
    },
    {
      href: 'https://cases.justia.com/federal/appellate-courts/ca2/21-487/21-487-2022-09-08.pdf?ts=1662663612',
      target: '_blank',
      rel: 'noopener noreferrer',
    },
    {
      href: 'https://github.blog/news-insights/company-news/oct21-post-incident-analysis/',
      target: '_blank',
      rel: 'noopener noreferrer',
    },
  ]);
  await expect(page.locator('#closing-title')).toHaveText(
    "What don't you know?"
  );
});

test('/why-causality: section index clears the fixed mobile header', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/why-causality', { waitUntil: 'load' });

  const targets = await page
    .locator('.page-index a')
    .evaluateAll((links) =>
      links.map((link) => new URL((link as HTMLAnchorElement).href).hash)
    );

  for (const target of targets) {
    expect(target).toMatch(/^#[a-z-]+$/);
    await page.locator(`.page-index a[href$="${target}"]`).click();

    const top = await page
      .locator(target)
      .evaluate((element) => Math.round(element.getBoundingClientRect().top));
    expect(top).toBeGreaterThanOrEqual(64);
  }
});

test('/deep-typing: selected compiled depth generates and passes runtime checks', async ({
  page,
}) => {
  await page.goto('/deep-typing', { waitUntil: 'load' });

  const depth = page.getByRole('spinbutton', {
    name: 'Depth to generate and test',
  });
  const generate = page.getByRole('button', { name: 'Generate and test' });

  await expect(depth).toHaveValue('15');
  await depth.fill('32');
  await generate.click();

  await expect(
    page.getByRole('heading', { name: 'The depth 32 path' })
  ).toBeVisible();
  await expect(page.locator('.path-ledger li')).toHaveCount(32);
  await expect(page.locator('.live-result output')).toContainText(
    'Depth 32 generated from a compiled fixture; runtime read/write passed.'
  );

  await page.getByRole('button', { name: 'Toggle deepest status' }).click();
  await expect(page.locator('.result-values dd').first()).toHaveText('review');

  await depth.fill('41');
  await expect(depth).toHaveAttribute('aria-invalid', 'true');
  await expect(generate).toBeDisabled();
  await expect(page.locator('#typing-depth-help')).toHaveText(
    'Enter a whole number from 1 to 40.'
  );
});
