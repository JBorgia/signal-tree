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
      const forcedLineBreaks = Array.from(
        document.querySelectorAll('main br')
      ).map(label);

      return {
        legacyColorUses,
        wrongHeadingFonts,
        roundedRectangles,
        floatingShadows,
        decorativeGradients,
        forcedLineBreaks,
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
    expect(
      audit.forcedLineBreaks,
      `${route} uses forced line breaks instead of semantic blocks or wrapping`
    ).toEqual([]);
  });
}

test('package docs share one responsive package-heading treatment', async ({
  page,
}) => {
  for (const viewport of [
    { width: 1400, height: 800 },
    { width: 320, height: 740 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/docs', { waitUntil: 'load' });

    const headings = [];
    for (const [index, packageName] of [
      [0, '@signal-tree/kernel'],
      [1, '@signal-tree/angular'],
      [2, '@signal-tree/react'],
    ] as const) {
      if (index > 0) await page.locator('.package-button').nth(index).click();
      const heading = page.locator('.markdown-content h1 > code:only-child');
      await expect(heading).toHaveText(packageName);

      headings.push(
        await heading.evaluate((element) => {
          const box = element.getBoundingClientRect();
          const article = element.closest('.markdown-content')?.getBoundingClientRect();
          const style = getComputedStyle(element);

          return {
            fontFamily: style.fontFamily,
            fontSize: style.fontSize,
            border: style.border,
            height: Math.round(box.height),
            insideArticle:
              !!article && box.left >= article.left && box.right <= article.right,
          };
        })
      );
    }

    const diagnostic = JSON.stringify({ viewport, headings });
    expect(
      new Set(headings.map((heading) => heading.fontFamily)).size,
      diagnostic
    ).toBe(1);
    expect(new Set(headings.map((heading) => heading.fontSize)).size).toBe(1);
    expect(new Set(headings.map((heading) => heading.border)).size).toBe(1);
    expect(new Set(headings.map((heading) => heading.height)).size).toBe(1);
    expect(headings.every((heading) => heading.insideArticle)).toBe(true);
  }
});

test('every idle sidebar destination uses one row treatment', async ({ page }) => {
  for (const viewport of [
    { width: 1400, height: 900 },
    { width: 558, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/docs', { waitUntil: 'load' });
    if (viewport.width < 1024) {
      await page.locator('.navigation-toggle').click();
      await expect(page.locator('.site-navigation')).toHaveClass(
        /site-navigation--open/
      );
    }

    const rows = await page.locator('.navigation-link').evaluateAll((links) =>
      links.map((link) => {
        const style = getComputedStyle(link);
        const title = link.querySelector<HTMLElement>(
          '.navigation-link__title'
        );
        if (!title) throw new Error('Navigation link is missing its title');
        const box = link.getBoundingClientRect();

        return {
          background: style.backgroundColor,
          border: style.border,
          padding: style.padding,
          titleInset: Math.round(title.getBoundingClientRect().left - box.left),
          titleWeight: getComputedStyle(title).fontWeight,
        };
      })
    );
    const diagnostic = JSON.stringify({ viewport, rows });

    for (const property of [
      'background',
      'border',
      'padding',
      'titleInset',
      'titleWeight',
    ] as const) {
      expect(
        new Set(rows.map((row) => row[property])).size,
        `${property}: ${diagnostic}`
      ).toBe(1);
    }
  }
});
