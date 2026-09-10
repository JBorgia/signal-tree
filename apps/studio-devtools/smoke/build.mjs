/**
 * Build both smoke pages.
 *
 *   node apps/studio-devtools/smoke/build.mjs
 *
 * `bundle.js` reproduces the frozen S1 transport fixture verbatim (README §1);
 * `demo.js` is the panel demo application. They are separate so a demo change
 * can never silently rewrite recorded S1 evidence.
 */
import { build } from 'esbuild';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..', '..');

await build({
  entryPoints: {
    bundle: join(here, 'page-entry.ts'),
    demo: join(here, 'demo-entry.ts'),
  },
  outdir: here,
  bundle: true,
  format: 'esm',
  logLevel: 'info',
  alias: {
    '@signal-tree/studio-adapter/bridge': join(repo, 'packages/studio-adapter/src/bridge/index.ts'),
    '@signal-tree/studio-adapter': join(repo, 'packages/studio-adapter/src/index.ts'),
    '@signal-tree/studio-query': join(repo, 'packages/studio-query/src/index.ts'),
    '@signal-tree/kernel/internals': join(repo, 'packages/kernel/src/internals.ts'),
    '@signal-tree/kernel/adapter': join(repo, 'packages/kernel/src/adapter.ts'),
    '@signal-tree/kernel': join(repo, 'packages/kernel/src/index.ts'),
  },
});
