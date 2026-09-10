/**
 * Build the unpacked extension.
 *
 *     THERE WAS NO BUILD TARGET UNTIL THE FIRST ATTEMPT TO ACTUALLY LOAD IT.
 *
 * `manifest.json` referenced `content/bridge.js`, `panel/index.html` referenced
 * `main.js`, and nothing produced either — every prior verification ran through
 * the smoke harness, which builds its own bundle.
 *
 *     node apps/studio-devtools/build.mjs   ->  dist/studio-devtools
 */
import { build } from 'esbuild';
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..');
const out = join(repo, 'dist', 'studio-devtools');

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

await build({
  entryPoints: {
    'content/bridge': join(here, 'content/bridge.ts'),
    'devtools/devtools': join(here, 'devtools/devtools.ts'),
    'panel/main': join(here, 'panel/main.ts'),
  },
  outdir: out,
  bundle: true,
  // ⚠️ A content script cannot be an ES module, so it must not be `format:
  // 'esm'`. The panel and devtools page are loaded as modules and are fine
  // either way; one format keeps the output uniform.
  format: 'iife',
  target: 'chrome120',
  logLevel: 'info',
  alias: {
    '@signal-tree/studio-query': join(repo, 'packages/studio-query/src/index.ts'),
    '@signal-tree/kernel/internals': join(repo, 'packages/kernel/src/internals.ts'),
    '@signal-tree/kernel/adapter': join(repo, 'packages/kernel/src/adapter.ts'),
    '@signal-tree/kernel': join(repo, 'packages/kernel/src/index.ts'),
  },
});

for (const file of ['manifest.json', 'devtools/devtools.html', 'panel/index.html', 'panel/panel.css']) {
  cpSync(join(here, file), join(out, file));
}
console.log(`\nunpacked extension -> ${out}`);
