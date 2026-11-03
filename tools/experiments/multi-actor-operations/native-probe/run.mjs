import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const source = process.argv[2];
const expected = '5727cd8fcf701128358674411400c019b137a5e4';
if (!source) throw new Error('Provide the active source checkout; do not silently use the older root runtime');
const root = resolve(source);
const git = (...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' }).trim();
if (git('rev-parse', 'HEAD') !== expected) throw new Error('Different source revision requires an explicit new probe disposition');
if (git('status', '--porcelain', '--', 'packages')) throw new Error('Package sources must match the identified revision');
const output = mkdtempSync(join(tmpdir(), 'st-operation-review-'));
try {
  const outfile = join(output, 'probe.mjs');
  await build({
    entryPoints: [fileURLToPath(new URL(process.argv[3] === '--workflow' ? './workflow.ts' : process.argv[3] === '--settlement' ? './settlement.ts' : './probe.ts', import.meta.url))],
    outfile, bundle: true, platform: 'node', format: 'esm', target: 'node24',
    nodePaths: [fileURLToPath(new URL('../../../../node_modules', import.meta.url))],
    alias: {
      '@signal-tree/kernel/internals': join(root, 'packages/kernel/src/internals.ts'),
      '@signal-tree/kernel': join(root, 'packages/kernel/src/index.ts'),
    },
  });
  process.stdout.write(execFileSync(process.execPath, [outfile], { encoding: 'utf8' }));
} finally { rmSync(output, { recursive: true, force: true }); }
