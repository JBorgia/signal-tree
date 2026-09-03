import { expect, test } from '@playwright/test';

const FRAME_ROUTES = [
  '/start',
  '/external-truth',
  '/examples/fundamentals',
  '/batching',
  '/entities',
  '/entity-sort-comparer',
  '/granular-reactivity',
  '/restoration',
  '/markers',
  '/devtools',
  '/examples/fundamentals/recommended-architecture',
  '/migrate',
  '/benchmarks',
  '/deep-typing',
  '/realistic-benchmark-history',
  '/legacy-changelog',
  '/docs',
] as const;

const VIEWPORTS = [
  { name: 'wide', width: 1920, height: 1000 },
  { name: 'narrow', width: 320, height: 800 },
] as const;

interface FrameAudit {
  readonly expectedWidth: number;
  readonly width: number;
  readonly leftGap: number;
  readonly rightGap: number;
  readonly paddingLeft: number;
  readonly paddingRight: number;
  readonly expectedPanelInset: number;
  readonly panel: boolean;
  readonly documentOverflow: number;
}

for (const viewport of VIEWPORTS) {
  test.describe(`layout system · ${viewport.name}`, () => {
    test.use({ viewport });

    for (const route of FRAME_ROUTES) {
      test(`${route} uses one standard frame`, async ({ page }) => {
        await page.goto(route, { waitUntil: 'load' });
        const frame = page.locator('main .layout-frame').first();
        await expect(frame).toBeVisible({ timeout: 20_000 });

        const audit = await frame.evaluate<FrameAudit>((element) => {
          const style = getComputedStyle(element);
          const main = document.querySelector('main');
          if (!main) throw new Error('Missing main element');

          const probe = document.createElement('div');
          probe.style.cssText = `
            position: fixed;
            visibility: hidden;
            width: var(--layout-gutter);
            padding-left: var(--layout-panel-inset);
          `;
          document.body.appendChild(probe);
          const probeStyle = getComputedStyle(probe);
          const gutter = probe.getBoundingClientRect().width;
          const panelInset = Number.parseFloat(probeStyle.paddingLeft);
          probe.remove();

          const mainBox = main.getBoundingClientRect();
          const frameBox = element.getBoundingClientRect();
          const expectedWidth = mainBox.width - 2 * gutter;

          return {
            expectedWidth,
            width: frameBox.width,
            leftGap: frameBox.left - mainBox.left,
            rightGap: mainBox.right - frameBox.right,
            paddingLeft: Number.parseFloat(style.paddingLeft),
            paddingRight: Number.parseFloat(style.paddingRight),
            expectedPanelInset: panelInset,
            panel: element.classList.contains('layout-frame--panel'),
            documentOverflow: Math.max(
              0,
              document.documentElement.scrollWidth -
                document.documentElement.clientWidth
            ),
          };
        });

        expect(audit.width).toBeCloseTo(audit.expectedWidth, 0);
        expect(audit.leftGap).toBeCloseTo(audit.rightGap, 0);
        expect(audit.paddingLeft).toBe(
          audit.panel ? audit.expectedPanelInset : 0
        );
        expect(audit.paddingRight).toBe(
          audit.panel ? audit.expectedPanelInset : 0
        );
        expect(audit.documentOverflow).toBe(0);
      });
    }
  });
}

test('Docs keeps its document switcher in flow instead of adding a second aside', async ({
  page,
}) => {
  await page.goto('/docs', { waitUntil: 'load' });

  await expect(page.locator('aside')).toHaveCount(1);
  await expect(page.locator('main .package-list')).toBeVisible();
  await expect(page.locator('main aside')).toHaveCount(0);
});

test('full-width bands align their inner content to the shared gutter', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 1000 });

  for (const [route, selector] of [
    ['/', '.hero-inner'],
    ['/architecture-overview', '.architecture-hero'],
  ] as const) {
    await page.goto(route, { waitUntil: 'load' });
    const alignment = await page.locator(selector).first().evaluate((element) => {
      const main = document.querySelector('main');
      if (!main) throw new Error('Missing main element');
      const mainBox = main.getBoundingClientRect();
      const box = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      const probe = document.createElement('div');
      probe.style.cssText =
        'position:fixed;visibility:hidden;width:var(--layout-gutter)';
      document.body.appendChild(probe);
      const gutter = probe.getBoundingClientRect().width;
      probe.remove();
      const leftContentEdge = box.left + Number.parseFloat(style.paddingLeft);
      const rightContentEdge = box.right - Number.parseFloat(style.paddingRight);

      return {
        expectedGap: gutter,
        leftGap: leftContentEdge - mainBox.left,
        rightGap: mainBox.right - rightContentEdge,
      };
    });

    expect(alignment.leftGap).toBeCloseTo(alignment.expectedGap, 0);
    expect(alignment.rightGap).toBeCloseTo(alignment.expectedGap, 0);
  }
});

test('architecture hero is content-driven and reveals the opening section', async ({
  page,
}) => {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 910, height: 768 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/architecture-overview', { waitUntil: 'load' });

    const geometry = await page
      .locator('.architecture-hero')
      .evaluate((hero) => {
        const opening = document.querySelector('.architecture-band--opening');
        if (!opening) throw new Error('Missing opening architecture section');

        return {
          minHeight: getComputedStyle(hero).minHeight,
          openingTop: opening.getBoundingClientRect().top,
        };
      });

    expect(geometry.minHeight).toBe('0px');
    expect(geometry.openingTop).toBeLessThan(viewport.height);
  }
});
