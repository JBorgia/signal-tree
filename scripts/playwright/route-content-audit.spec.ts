import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test } from '@playwright/test';

import { DEMO_ROUTES } from './demo-routes';

const routeSource = readFileSync('apps/demo/src/app/app.routes.ts', 'utf8');
const declaredPaths = new Set(
  Array.from(
    routeSource.matchAll(/\bpath:\s*'([^']*)'/g),
    (match) => '/' + match[1]
  ).filter((route) => route !== '/**')
);
const dist = process.env['DEMO_DIST'] ?? 'dist/apps/demo/browser';
const evidence = 'artifacts/v15-adoption-story/routes';

test('the browser inventory covers every routed component exactly once', () => {
  // The application has a flat route array, including explicit redirect aliases.
  const componentRoutes = Array.from(
    routeSource.matchAll(/\bpath:\s*'([^']*)'([\s\S]*?)(?=\bpath:|$)/g)
  )
    .filter((match) => match[2].includes('loadComponent:'))
    .map((match) => '/' + match[1])
    .sort();
  expect(componentRoutes.length).toBeGreaterThan(0);
  expect([...DEMO_ROUTES].sort()).toEqual(componentRoutes);
  expect(new Set(DEMO_ROUTES).size).toBe(DEMO_ROUTES.length);
});

for (const route of DEMO_ROUTES) {
  test(`${route} exposes its content and resolves local navigation targets`, async ({
    page,
  }) => {
    await page.goto(route);
    await expect(page.locator('main h1').first()).toBeVisible();
    if (route === '/docs') {
      await expect(page.locator('.markdown-content h1').first()).toBeVisible();
    }
    const content = await page.locator('main').evaluate((main) => ({
      headings: Array.from(main.querySelectorAll('h1,h2,h3')).map((element) =>
        element.textContent?.replace(/\s+/g, ' ').trim()
      ),
      introduction: main.textContent
        ?.replace(/\s+/g, ' ')
        .trim()
        .slice(0, 1500),
      controls: Array.from(main.querySelectorAll('button, input, select')).map(
        (element) => ({
          kind: element.tagName.toLowerCase(),
          label:
            element.getAttribute('aria-label') ??
            element.textContent?.replace(/\s+/g, ' ').trim(),
        })
      ),
      links: Array.from(
        main.querySelectorAll<HTMLAnchorElement>('a[href]')
      ).map((link) => ({
        label: link.textContent?.trim(),
        href: link.href,
        authoredHref: link.getAttribute('href'),
      })),
      ids: Array.from(document.querySelectorAll('[id]')).map(
        (element) => element.id
      ),
      overflow: document.documentElement.scrollWidth - window.innerWidth,
    }));
    expect(content.headings.length).toBeGreaterThan(0);
    expect(content.overflow).toBe(0);
    const current = new URL(page.url());
    const unchecked: { href: string; reason: string }[] = [];
    for (const link of content.links) {
      const target = new URL(link.href);
      if (link.authoredHref?.startsWith('#')) {
        expect(
          target.pathname,
          `Fragment left ${route} because of the document base href`
        ).toBe(current.pathname);
        expect(target.search).toBe(current.search);
      }
      if (target.origin !== current.origin) {
        unchecked.push({
          href: target.href,
          reason:
            'External destination; local browser audit does not establish remote availability.',
        });
        continue;
      }
      if (target.pathname.startsWith('/v14/')) {
        unchecked.push({
          href: target.href,
          reason:
            'Historical site is assembled by build-demo-site.mjs and checked at deployment.',
        });
        continue;
      }
      expect(
        declaredPaths.has(target.pathname) ||
          existsSync(join(dist, target.pathname)),
        `Unresolved local target on ${route}: ${target.pathname}`
      ).toBe(true);
      if (
        target.pathname === current.pathname &&
        target.search === current.search &&
        target.hash
      ) {
        expect(
          content.ids,
          `Missing anchor on ${route}: ${target.hash}`
        ).toContain(decodeURIComponent(target.hash.slice(1)));
      }
    }
    mkdirSync(evidence, { recursive: true });
    writeFileSync(
      join(
        evidence,
        `${route === '/' ? 'home' : route.slice(1).replaceAll('/', '--')}.json`
      ),
      JSON.stringify(
        { route, viewport: page.viewportSize(), content, unchecked },
        null,
        2
      ) + '\n'
    );
    const pageName =
      route === '/' ? 'home' : route.slice(1).replaceAll('/', '--');
    for (const viewport of [
      { width: 1280, height: 900 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(viewport);
      await page.reload();
      await expect(page.locator('main h1').first()).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({
        path: join(evidence, `${pageName}-${viewport.width}.png`),
        animations: 'disabled',
      });
    }
  });
}

for (const width of [1280, 390]) {
  test(`section links and skip navigation stay on their page at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const [route, fragment] of [
      ['/start', 'feature'],
      ['/migrate', 'construct'],
      ['/architecture-overview', 'accessor-grammar'],
    ]) {
      await page.goto(route);
      await page.locator(`a[href="${route}#${fragment}"]`).click();
      expect(new URL(page.url()).pathname).toBe(route);
      expect(new URL(page.url()).hash).toBe('#' + fragment);
      await expect(page.locator('#' + fragment)).toBeInViewport();
      await expect(page.locator('#' + fragment)).toBeFocused();
    }
    await page.goto('/docs?package=first-feature-v15');
    const originalUrl = page.url();
    const skip = page.getByRole('link', {
      name: 'Skip to content',
      exact: true,
    });
    await skip.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#main-content')).toBeFocused();
    expect(page.url()).toBe(originalUrl);
    expect(new URL(page.url()).pathname).toBe('/docs');
    expect(new URL(page.url()).searchParams.get('package')).toBe(
      'first-feature-v15'
    );
  });
}
