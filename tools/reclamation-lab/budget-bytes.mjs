#!/usr/bin/env node
// Execute the canonical gate's exact fixture text and esbuild settings, while
// printing integer gzip bytes and optional scheduler reachability per artifact.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { build, version as esbuild } from 'esbuild';
const [frozenArg, projectionArg, candidateArg, outputArg] =
  process.argv.slice(2);
assert.ok(frozenArg && projectionArg && candidateArg && outputArg);
const script = fileURLToPath(import.meta.url),
  gate = resolve('tools/check-bundle-budget.mjs');
const source = readFileSync(gate, 'utf8'),
  sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
const declaration = source.slice(
  source.indexOf('const TARGETS ='),
  source.indexOf('const EXTERNAL =')
);
const rows = [],
  dir = mkdtempSync(join(tmpdir(), 'st-reclamation-budget-'));
for (const [arm, argument] of [
  ['frozen', frozenArg],
  ['projection', projectionArg],
  ['candidate', candidateArg],
]) {
  const root = resolve(argument),
    core = join(root, 'dist/index.js');
  const fixtures = new Function('CORE', declaration + ';return TARGETS;')(core);
  for (const [target, fixture] of Object.entries(fixtures)) {
    const entry = join(dir, `${arm}-${target}.mjs`);
    writeFileSync(entry, fixture.code);
    for (const mode of ['prod', 'dev']) {
      const output = await build({
        entryPoints: [entry],
        bundle: true,
        minify: true,
        format: 'esm',
        platform: 'browser',
        treeShaking: true,
        external: ['@angular/*', 'rxjs', 'rxjs/*', 'tslib'],
        nodePaths: [resolve('node_modules')],
        write: false,
        legalComments: 'none',
        logLevel: 'silent',
        define: mode === 'prod' ? { ngDevMode: 'false' } : {},
        metafile: true,
      });
      const bytes = Buffer.from(output.outputFiles[0].contents),
        budgetBytes = fixture[`${mode}KB`] * 1024;
      const inputBytes = Object.assign(
        {},
        ...Object.values(output.metafile.outputs).map((out) => out.inputs)
      );
      const schedulerBytes = Object.entries(inputBytes)
        .filter(([p]) => p.includes('subject-reclamation-sink'))
        .reduce((sum, [, v]) => sum + v.bytesInOutput, 0);
      rows.push({
        arm,
        root,
        target,
        mode,
        gzipBytes: gzipSync(bytes, { level: 9 }).length,
        budgetBytes,
        schedulerBytes,
        bundleSha256: createHash('sha256').update(bytes).digest('hex'),
      });
    }
  }
}
const result = {
  command: [process.execPath, ...process.argv.slice(1)],
  esbuild,
  gateSha256: sha(gate),
  generatorSha256: sha(script),
  rows,
};
writeFileSync(outputArg, JSON.stringify(result, null, 2) + '\n', {
  flag: 'wx',
});
console.log(JSON.stringify(result));
