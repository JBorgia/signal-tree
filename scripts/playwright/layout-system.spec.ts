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
            height: var(--layout-wide-max);
            padding-left: var(--layout-panel-inset);
          `;
          document.body.appendChild(probe);
          const probeStyle = getComputedStyle(probe);
          const gutter = probe.getBoundingClientRect().width;
          const maxWidth = probe.getBoundingClientRect().height;
          const panelInset = Number.parseFloat(probeStyle.paddingLeft);
          probe.remove();

          const mainBox = main.getBoundingClientRect();
          const frameBox = element.getBoundingClientRect();
          const expectedWidth = Math.min(mainBox.width - 2 * gutter, maxWidth);

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

test('full-width bands align their inner content to the shared width system', async ({
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
        'position:fixed;visibility:hidden;width:var(--layout-wide-max)';
      document.body.appendChild(probe);
      const maxWidth = probe.getBoundingClientRect().width;
      probe.remove();
      const leftContentEdge = box.left + Number.parseFloat(style.paddingLeft);
      const rightContentEdge = box.right - Number.parseFloat(style.paddingRight);
      const contentWidth = Math.min(rightContentEdge - leftContentEdge, maxWidth);
      const expectedGap = (mainBox.width - contentWidth) / 2;

      return {
        expectedGap,
        leftGap: leftContentEdge - mainBox.left,
        rightGap: mainBox.right - rightContentEdge,
      };
    });

    expect(alignment.leftGap).toBeCloseTo(alignment.expectedGap, 0);
    expect(alignment.rightGap).toBeCloseTo(alignment.expectedGap, 0);
  }
});
