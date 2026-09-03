import { expect, test } from '@playwright/test';

import { DEMO_ROUTES } from './demo-routes';

interface HoverSnapshot {
  readonly boxes: readonly (readonly number[])[];
  readonly target: readonly number[];
  readonly styles: readonly string[];
  readonly before: string;
  readonly after: string;
  readonly shadows: readonly string[];
  readonly viewportWidth: number;
  readonly viewportHeight: number;
}

interface HoverIssue {
  readonly route: string;
  readonly control: string;
  readonly reason: string;
}

const CONTROL_SELECTOR = [
  'a[href]:not(.skip-link)',
  'button:not(:disabled)',
  'summary',
  'input:not(:disabled)',
  'select:not(:disabled)',
  'textarea:not(:disabled)',
  '[role="button"]:not([aria-disabled="true"])',
  '[role="tab"]:not([aria-disabled="true"])',
].join(', ');

const captureHoverState = async (
  locator: import('@playwright/test').Locator
): Promise<HoverSnapshot> =>
  locator.evaluate((element) => {
    const geometryNodes = [
      element,
      ...Array.from(element.querySelectorAll('*')),
    ].slice(0, 24);
    const styleNodes = [
      ...geometryNodes,
      element.parentElement,
      element.parentElement?.parentElement,
    ].filter((node): node is Element => node !== null && node !== undefined);
    const styleOf = (node: Element, pseudo: string | null): string => {
      const style = getComputedStyle(node, pseudo);
      return [
        style.color,
        style.backgroundColor,
        style.borderTopColor,
        style.borderRightColor,
        style.borderBottomColor,
        style.borderLeftColor,
        style.textDecorationColor,
        style.textDecorationLine,
        style.textDecorationThickness,
        style.opacity,
        style.transform,
        style.boxShadow,
        style.filter,
        style.fontWeight,
        style.outlineColor,
        style.outlineStyle,
        style.outlineWidth,
        style.content,
      ].join('|');
    };

    const rootBox = element.getBoundingClientRect();
    return {
      target: [rootBox.left, rootBox.top, rootBox.width, rootBox.height],
      boxes: geometryNodes.map((node) => {
        const box = node.getBoundingClientRect();
        return [
          box.left - rootBox.left,
          box.top - rootBox.top,
          box.width,
          box.height,
        ];
      }),
      styles: styleNodes.map((node) => styleOf(node, null)),
      before: styleOf(element, '::before'),
      after: styleOf(element, '::after'),
      shadows: styleNodes.map((node) => getComputedStyle(node).boxShadow),
      viewportWidth: document.documentElement.clientWidth,
      viewportHeight: document.documentElement.clientHeight,
    };
  });

const moved = (before: HoverSnapshot, after: HoverSnapshot): boolean =>
  after.boxes.some((box, nodeIndex) =>
    box.some(
      (value, part) =>
        Math.abs(value - (before.boxes[nodeIndex]?.[part] ?? value)) > 0.75
    )
  );

const changed = (before: HoverSnapshot, after: HoverSnapshot): boolean =>
  JSON.stringify(before.styles) !== JSON.stringify(after.styles) ||
  before.before !== after.before ||
  before.after !== after.after;

test('mouse-over states stay visible and geometrically stable', async ({
  page,
}) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1280, height: 900 });

  const issues: HoverIssue[] = [];

  for (const route of DEMO_ROUTES) {
    await page.goto(route, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    await page.addStyleTag({
      content: '* { transition: none !important; animation: none !important; }',
    });

    const controls = page.locator(CONTROL_SELECTOR);
    const count = await controls.count();
    for (let index = 0; index < count; index += 1) {
      const control = controls.nth(index);
      if (!(await control.isVisible())) continue;

      const metadata = await control.evaluate((element) => {
        const text =
          element.textContent?.replace(/\s+/g, ' ').trim() ||
          element.getAttribute('aria-label') ||
          element.getAttribute('name') ||
          element.tagName.toLowerCase();
        return {
          label: `${element.tagName.toLowerCase()}: ${text.slice(0, 70)}`,
          type: element.getAttribute('type') ?? '',
          selected:
            element.getAttribute('aria-pressed') === 'true' ||
            element.getAttribute('aria-selected') === 'true' ||
            element.classList.contains('navigation-link--active'),
        };
      });

      await control.evaluate((element) =>
        element.scrollIntoView({ block: 'center', inline: 'center' })
      );
      await page.mouse.move(0, 0);
      const before = await captureHoverState(control);
      const target = before.target;
      if (!target) continue;
      const centerX = target[0] + target[2] / 2;
      const centerY = target[1] + target[3] / 2;
      if (
        centerX < 0 ||
        centerX > before.viewportWidth ||
        centerY < 0 ||
        centerY > before.viewportHeight
      ) {
        continue;
      }

      await page.mouse.move(centerX, centerY);
      const after = await captureHoverState(control);

      if (moved(before, after)) {
        issues.push({
          route,
          control: `${metadata.label} [type=${metadata.type}]`,
          reason: `geometry moved ${JSON.stringify({
            before: before.boxes,
            after: after.boxes,
          })}`,
        });
      }
      if (
        after.shadows.some(
          (shadow, shadowIndex) => shadow !== before.shadows[shadowIndex]
        )
      ) {
        issues.push({
          route,
          control: metadata.label,
          reason: 'shadow changed',
        });
      }
      if (!metadata.selected && !changed(before, after)) {
        issues.push({
          route,
          control: metadata.label,
          reason: 'no visible hover response',
        });
      }
    }
  }

  expect(issues).toEqual([]);
});
