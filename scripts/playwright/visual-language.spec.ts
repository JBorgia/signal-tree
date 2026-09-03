import { expect, test } from '@playwright/test';

import { DEMO_ROUTES } from './demo-routes';

const LEGACY_COLORS = new Set([
  'rgb(10, 15, 26)',
  'rgb(15, 23, 42)',
  'rgb(17, 24, 39)',
  'rgb(30, 41, 59)',
  'rgb(51, 65, 85)',
  'rgb(29, 78, 216)',
  'rgb(30, 64, 175)',
  'rgb(37, 99, 235)',
  'rgb(59, 130, 246)',
  'rgb(96, 165, 250)',
  'rgb(147, 197, 253)',
  'rgb(124, 58, 237)',
  'rgb(147, 51, 234)',
  'rgb(168, 85, 247)',
]);

for (const route of DEMO_ROUTES) {
  test(`${route} uses the v15 visual language`, async ({ page }) => {
    await page.goto(route, { waitUntil: 'load' });
    await expect(page.locator('h1, main').first()).toBeVisible({
      timeout: 20_000,
    });
    await page.evaluate(() => document.fonts.ready);

    const audit = await page.evaluate((legacyColors) => {
      const forbidden = new Set(legacyColors);
      const colorProperties = [
        'color',
        'backgroundColor',
        'borderTopColor',
        'borderRightColor',
        'borderBottomColor',
        'borderLeftColor',
        'fill',
        'stroke',
      ] as const;
      const visible = (element: Element): boolean => {
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
      const label = (element: Element): string => {
        const identity =
          element.id ||
          Array.from(element.classList).slice(0, 2).join('.') ||
          element.tagName.toLowerCase();
        const text = element.textContent?.replace(/\s+/g, ' ').trim() ?? '';
        return `${identity}: ${text.slice(0, 70)}`;
      };

      const legacyColorUses = Array.from(document.querySelectorAll('body *'))
        .filter(visible)
        .flatMap((element) => {
          const style = getComputedStyle(element);
          return colorProperties
            .filter((property) => forbidden.has(style[property]))
            .map((property) => `${label(element)} [${property}=${style[property]}]`);
        })
        .slice(0, 40);

      const wrongHeadingFonts = Array.from(
        document.querySelectorAll('main h1, main h2')
      )
        .filter(visible)
        .filter((heading) => {
          const family = getComputedStyle(heading).fontFamily;
          return !/Space Grotesk|Avenir Next|Trebuchet MS/.test(family);
        })
        .map(label)
        .slice(0, 20);

      const visualElements = Array.from(
        document.querySelectorAll('body *:not(svg):not(g):not(path):not(rect)')
      ).filter(visible);
      const roundedRectangles = visualElements
        .filter((element) => {
          const style = getComputedStyle(element);
          const box = element.getBoundingClientRect();
          const radius = Number.parseFloat(style.borderTopLeftRadius) || 0;
          const isCircle =
            Math.abs(box.width - box.height) <= 2 &&
            radius >= Math.min(box.width, box.height) * 0.45;
          return radius > 0.1 && !isCircle;
        })
        .map(label)
        .slice(0, 40);
      const floatingShadows = visualElements
        .filter((element) => getComputedStyle(element).boxShadow !== 'none')
        .map(label)
        .slice(0, 40);
      const decorativeGradients = visualElements
        .filter((element) => {
          const style = getComputedStyle(element);
          const hasGradient = /gradient/.test(style.backgroundImage);
          const isGridField =
            style.backgroundSize.includes('34px 34px') ||
            style.backgroundSize.includes('24px 24px');
          return hasGradient && !isGridField;
        })
        .map(label)
        .slice(0, 40);

      return {
        legacyColorUses,
        wrongHeadingFonts,
        roundedRectangles,
        floatingShadows,
        decorativeGradients,
      };
    }, [...LEGACY_COLORS]);

    expect(
      audit.legacyColorUses,
      `${route} still renders colors from the pre-v15 demo palette`
    ).toEqual([]);
    expect(
      audit.wrongHeadingFonts,
      `${route} bypasses the shared architecture display typography`
    ).toEqual([]);
    expect(
      audit.roundedRectangles,
      `${route} renders rounded rectangular UI outside the flat v15 language`
    ).toEqual([]);
    expect(
      audit.floatingShadows,
      `${route} renders floating shadows outside the flat v15 language`
    ).toEqual([]);
    expect(
      audit.decorativeGradients,
      `${route} renders decorative gradients outside the grid-field language`
    ).toEqual([]);
  });
}
