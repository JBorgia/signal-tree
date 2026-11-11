#!/usr/bin/env node
// Adapt v15's public transaction() spelling to the common aging workload's
// transact() slot. Both arms use this identical adapter; no runtime alias ships.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, version as esbuild } from 'esbuild';
const [baselineArg, candidateArg, outArg] = process.argv.slice(2);
assert.ok(baselineArg && candidateArg && outArg);
const out = resolve(outArg),
  runner = fileURLToPath(import.meta.url);
mkdirSync(out, { recursive: false });
const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
const save = (p, value) =>
  writeFileSync(p, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const summaries = [];
for (const [arm, argument] of [
  ['baseline', baselineArg],
  ['lazy', candidateArg],
]) {
  const root = resolve(argument),
    files = {};
  const walk = (relative = '') => {
    for (const entry of readdirSync(join(root, relative), {
      withFileTypes: true,
    })) {
      const name = join(relative, entry.name);
      if (entry.isDirectory()) walk(name);
      else if (entry.isFile()) files[name] = sha(join(root, name));
    }
  };
  walk();
  const planPath = join(out, `${arm}.plan.json`);
  save(planPath, {
    root,
    files,
    sourceGenerator: runner,
    sourceGeneratorSha256: sha(runner),
    armMeaning:
      arm === 'lazy'
        ? 'v15 projection plus post-capture reclamation candidate'
        : 'released v15.4.8',
    limits:
      'v15-to-v15 comparison; not equivalent to all v16 coordination guarantees',
  });
  const staging = mkdtempSync(join(tmpdir(), 'st-v15-aging-package-'));
  cpSync(root, join(staging, 'package'), { recursive: true });
  const archive = join(out, `${arm}.tgz`);
  execFileSync('tar', ['-czf', archive, '-C', staging, 'package']);
  const source = join(out, `${arm}.entry.mjs`);
  writeFileSync(
    source,
    `import {signalTree,entityMap,transactions,link} from ${JSON.stringify(
      join(root, 'dist/index.js')
    )};\nimport {transactionLifecycleReader} from ${JSON.stringify(
      join(root, 'dist/internals.js')
    )};\nexport function create(){const original=signalTree({rows:entityMap({selectId:r=>r.id})},{enhancers:[transactions()]});return {$:original.$,original,transact:fn=>original.transaction(fn),destroy:()=>original.destroy()};}\nexport function attach(tree,set){return link(tree.$.rows,{set});}\nexport function populate(tree,rows){tree.$.rows.setAll(rows);}\nexport function read(tree){return tree.$.rows.all();}\nexport function pending(tree){return transactionLifecycleReader(tree.original).snapshot().pending.length;}\n`
  );
  const bundle = join(out, `${arm}.production.mjs`);
  const result = await build({
    entryPoints: [source],
    outfile: bundle,
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'node24',
    minify: true,
    define: { ngDevMode: 'false', 'process.env.NODE_ENV': '"production"' },
    metafile: true,
  });
  save(join(out, `${arm}.metafile.json`), result.metafile);
  for (const [name, hash] of Object.entries(files))
    assert.equal(sha(join(root, name)), hash);
  summaries.push({
    arm,
    root,
    packageVersion: JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
      .version,
    planPath,
    planSha256: sha(planPath),
    archive,
    archiveIntegrity:
      'sha512-' +
      createHash('sha512').update(readFileSync(archive)).digest('base64'),
    source,
    sourceSha256: sha(source),
    bundle,
    bundleSha256: sha(bundle),
    esbuild,
  });
}
save(join(out, 'bundles.json'), {
  command: [process.execPath, ...process.argv.slice(1)],
  generatorSha256: sha(runner),
  summaries,
});
console.log(JSON.stringify({ out, summaries }));
