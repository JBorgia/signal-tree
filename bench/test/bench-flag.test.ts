/**
 * Bench-only code must leave no trace in a production bundle: neither the
 * __SIGNAL_TREE_BENCH__ identifier nor any `signal-tree:` name. That holds
 * only when the production build defines the flag as false.
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { buildAngularConfiguration } from '../runner/app-build.ts';
import { tempOut } from './helpers.ts';

const FLAG = '__SIGNAL_TREE_BENCH__';
const NAMES = 'signal-tree:';

async function bundle(module: string, define: Record<string, string>): Promise<string> {
  const result = await build({
    entryPoints: [fileURLToPath(new URL(module, import.meta.url))],
    bundle: true,
    minify: true,
    write: false,
    format: 'esm',
    platform: 'browser',
    define,
    external: ['@angular/core', '@signal-tree/angular'],
    logLevel: 'silent',
  });
  return result.outputFiles[0]!.text;
}

for (const module of ['../subjects/bench-flag.ts', '../subjects/v15-shim.ts']) {
  test(`${module.split('/').pop()} minified with the flag defined false keeps no bench code`, async () => {
    const production = await bundle(module, { [FLAG]: 'false' });
    assert.ok(!production.includes(FLAG));
    assert.ok(!production.includes(NAMES));
    const bench = await bundle(module, { [FLAG]: 'true' });
    assert.ok(bench.includes(NAMES), 'the bench build does place the measure');
  });

  test(`${module.split('/').pop()} minified with the flag left undefined keeps the identifier (the scan must reject it)`, async () => {
    assert.ok((await bundle(module, {})).includes(FLAG));
  });
}

test("the reference app's production configuration keeps no bench code", () => {
  const dir = buildAngularConfiguration('production', join(tempOut(), 'app-production'));
  const scripts = readdirSync(dir).filter((file) => file.endsWith('.js'));
  assert.ok(scripts.length > 0);
  for (const file of scripts) {
    const text = readFileSync(join(dir, file), 'utf8');
    assert.ok(!text.includes(FLAG), `${file} contains ${FLAG}`);
    assert.ok(!text.includes(NAMES), `${file} contains ${NAMES}`);
  }
});
