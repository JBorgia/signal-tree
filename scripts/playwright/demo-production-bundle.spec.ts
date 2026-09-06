import { readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

import { expect, test } from '@playwright/test';

const DIST_ROOT = resolve(
  process.cwd(),
  process.env['DEMO_DIST'] ?? 'dist/apps/demo/browser'
);

const emittedFiles = (root: string): string[] => {
  const files: string[] = [];
  const pending = [root];

  while (pending.length > 0) {
    const directory = pending.pop();
    if (!directory) continue;

    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) pending.push(path);
      else files.push(path);
    }
  }

  return files;
};

test('production shell excludes retired eager and development runtimes', () => {
  const files = emittedFiles(DIST_ROOT);
  const mainFiles = files.filter((file) =>
    /^main-.*\.js$/.test(basename(file))
  );
  const polyfillFiles = files.filter((file) =>
    /^polyfills(?:-.*)?\.js$/.test(basename(file))
  );

  expect(mainFiles).toHaveLength(1);
  expect(polyfillFiles).toEqual([]);

  const mainPath = mainFiles[0];
  const emittedJavaScript = files
    .filter((file) => file.endsWith('.js'))
    .map((file) => readFileSync(file, 'utf8'))
    .join('\n');

  expect(emittedJavaScript).not.toMatch(/echarts|zrender/);
  expect(emittedJavaScript).not.toContain('__REDUX_DEVTOOLS_EXTENSION__');
  expect(statSync(mainPath).size).toBeLessThan(525_000);
});
