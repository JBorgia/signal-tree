import { expect, test } from '@playwright/test';

import { DEMO_ROUTES } from './demo-routes';

const MOBILE_VIEWPORTS = [
  { name: 'narrow', width: 320, height: 740 },
  { name: 'phone', width: 390, height: 844 },
] as const;

interface MobileLayoutAudit {
  readonly documentOverflow: number;
  readonly clippedText: readonly string[];
  readonly viewportEscapes: readonly string[];
  readonly headingTop: number | null;
}

for (const viewport of MOBILE_VIEWPORTS) {
  test.describe(`mobile layout · ${viewport.name}`, () => {
    test.use({ viewport });

    for (const route of DEMO_ROUTES) {
      test(`${route} fits ${viewport.width}px`, async ({ page }) => {
        await page.goto(route, { waitUntil: 'load' });
        await expect(page.locator('h1, main').first()).toBeVisible({
          timeout: 20_000,
        });
        await page.evaluate(() => document.fonts.ready);

        const audit = await page.evaluate<MobileLayoutAudit>(() => {
          const viewportWidth = document.documentElement.clientWidth;
          const elementLabel = (element: Element): string => {
            const name =
              element.getAttribute('aria-label') ??
              element.textContent?.replace(/\s+/g, ' ').trim() ??
              '';
            const identity =
              element.id ||
              Array.from(element.classList).slice(0, 2).join('.') ||
              element.tagName.toLowerCase();
            return `${identity}: ${name.slice(0, 80)}`;
          };
          const isRendered = (element: Element): boolean => {
            const style = getComputedStyle(element);
            const box = element.getBoundingClientRect();
            return (
              style.display !== 'none' &&
              style.visibility !== 'hidden' &&
              Number(style.opacity) !== 0 &&
              box.width > 0 &&
              box.height > 0
            );
          };
          const hasHorizontalScroller = (element: Element): boolean => {
            let current = element.parentElement;
            while (current && current !== document.body) {
              const overflow = getComputedStyle(current).overflowX;
              if (overflow === 'auto' || overflow === 'scroll') return true;
              current = current.parentElement;
            }
            return false;
          };
          const inClosedNavigation = (element: Element): boolean =>
            Boolean(
              element.closest(
                '.site-navigation:not(.site-navigation--open), ' +
                  '.sidebar:not(.sidebar-open)'
              )
            );

          const textCandidates = Array.from(
            document.querySelectorAll(
              'h1, h2, h3, button, a, label, [role="button"], [role="tab"]'
            )
          );
          const clippedText = textCandidates
            .filter(isRendered)
            .filter((element) => !inClosedNavigation(element))
            .filter((element) => !hasHorizontalScroller(element))
            .filter(
              (element) =>
                element.scrollWidth > element.clientWidth + 2 &&
                getComputedStyle(element).textOverflow !== 'ellipsis'
            )
            .map(elementLabel);

          const geometryCandidates = Array.from(
            document.querySelectorAll(
              'h1, h2, h3, button, a, input, select, textarea, img, svg, canvas, table, [role="button"], [role="tab"]'
            )
          );
          const viewportEscapes = geometryCandidates
            .filter(isRendered)
            .filter((element) => !inClosedNavigation(element))
            .filter((element) => !hasHorizontalScroller(element))
            .filter((element) => {
              const box = element.getBoundingClientRect();
              return box.left < -1 || box.right > viewportWidth + 1;
            })
            .map(elementLabel);

          const heading = document.querySelector('h1');
          return {
            documentOverflow: Math.max(
              0,
              document.documentElement.scrollWidth - viewportWidth
            ),
            clippedText,
            viewportEscapes,
            headingTop: heading
              ? Math.round(heading.getBoundingClientRect().top)
              : null,
          };
        });

        expect(
          audit.documentOverflow,
          `${route} makes the document wider than ${viewport.width}px`
        ).toBe(0);
        expect(
          audit.clippedText,
          `${route} clips visible text at ${viewport.width}px`
        ).toEqual([]);
        expect(
          audit.viewportEscapes,
          `${route} has elements outside ${viewport.width}px without a scroll container`
        ).toEqual([]);
        if (audit.headingTop !== null) {
          expect(
            audit.headingTop,
            `${route} heading is hidden beneath the 64px mobile app bar`
          ).toBeGreaterThanOrEqual(64);
        }
      });
    }
  });
}

test('open navigation dims the page without blocking it', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 720 });
  await page.goto('/docs', { waitUntil: 'load' });

  await page.locator('.navigation-toggle').click();
  await expect(page.locator('.site-navigation')).toHaveClass(/site-navigation--open/);
  await expect(page.locator('.navigation-backdrop')).toBeVisible();
  await expect(page.locator('.navigation-backdrop')).toHaveCSS(
    'pointer-events',
    'none'
  );

  const packageButton = page.locator('.package-button').nth(1);
  await packageButton.click();
  await expect(packageButton).toHaveClass(/active/);
  await expect(page.locator('.site-navigation')).toHaveClass(/site-navigation--open/);

  const initialScroll = await page.evaluate(() => window.scrollY);
  await page.mouse.move(740, 680);
  await page.mouse.wheel(0, 600);
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBeGreaterThan(initialScroll);

  await page.locator('.drawer-close').click();
  await expect(page.locator('.site-navigation')).not.toHaveClass(
    /site-navigation--open/
  );
});
