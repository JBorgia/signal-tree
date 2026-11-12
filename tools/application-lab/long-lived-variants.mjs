#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const [packetArg, baselineArg, candidateArg, outArg] = process.argv.slice(2);
assert.ok(packetArg && baselineArg && candidateArg && outArg);
const packet = resolve(packetArg),
  baseline = resolve(baselineArg),
  candidate = resolve(candidateArg),
  out = resolve(outArg);
const read = (p) => JSON.parse(readFileSync(p, 'utf8'));
const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
const write = (p, value) =>
  writeFileSync(p, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
assert.ok(!existsSync(out), 'Preserve earlier attempts');
mkdirSync(out, { recursive: true });
const plan = read(join(packet, 'plan.json'));
const originalSchedule = read(join(baseline, 'schedule.json'));
const originalResults = read(join(baseline, 'results.json'));
assert.equal(originalResults.passed, true);
assert.equal(
  originalResults.scheduleSha256,
  sha(join(baseline, 'schedule.json'))
);
for (const [p, digest] of Object.entries(originalSchedule.bindings))
  assert.equal(sha(p), digest);
const runner = fileURLToPath(new URL('./long-lived.mjs', import.meta.url));
const protocol = fileURLToPath(
  new URL('./long-lived-variants.md', import.meta.url)
);
const self = fileURLToPath(import.meta.url);
const toolRequire = createRequire(
  join(plan.toolchainDirectory, 'package.json')
);
const esbuild = await import(
  pathToFileURL(toolRequire.resolve('esbuild')).href
);
const core = toolRequire.resolve('@angular/core');
const manifestPath = join(candidate, 'package.json'),
  manifest = read(manifestPath);
assert.equal(manifest.name, '@signal-tree/kernel');
assert.equal(manifest.version, '15.4.8');
const entryPath = join(out, 'candidate-entry.mjs'),
  bundlePath = join(out, 'candidate-bundle.mjs'),
  metaPath = join(out, 'candidate-metafile.json');
writeFileSync(
  entryPath,
  `export { signalTree, entityMap } from ${JSON.stringify(
    join(packet, 'v15/node_modules/@signal-tree/angular/dist/index.js')
  )};\n`,
  { flag: 'wx' }
);
const built = await esbuild.build({
  entryPoints: [entryPath],
  outfile: bundlePath,
  platform: 'node',
  format: 'esm',
  bundle: true,
  treeShaking: true,
  minify: true,
  metafile: true,
  define: { ngDevMode: 'false', 'process.env.NODE_ENV': '"production"' },
  plugins: [
    {
      name: 'candidate-kernel',
      setup(build) {
        build.onResolve({ filter: /^@angular\/core$/ }, () => ({
          path: core,
          external: true,
        }));
        build.onResolve(
          { filter: /^@signal-tree\/kernel(?:\/.*)?$/ },
          (args) => {
            const suffix = args.path.slice('@signal-tree/kernel'.length);
            const target = manifest.exports[suffix ? '.' + suffix : '.'];
            assert.ok(
              target?.import,
              `Unsupported candidate entry ${args.path}`
            );
            return { path: resolve(candidate, target.import) };
          }
        );
      },
    },
  ],
});
write(metaPath, built.metafile);
const bindings = {
  [manifestPath]: sha(manifestPath),
  [entryPath]: sha(entryPath),
  [bundlePath]: sha(bundlePath),
  [metaPath]: sha(metaPath),
  [runner]: sha(runner),
  [protocol]: sha(protocol),
  [self]: sha(self),
};
for (const p of Object.keys(built.metafile.inputs))
  bindings[resolve(p)] = sha(resolve(p));
for (const output of Object.values(built.metafile.outputs))
  for (const [p, contribution] of Object.entries(output.inputs ?? {}))
    if (
      p.includes(
        '/application-baseline-4/v15/node_modules/@signal-tree/kernel/'
      ) &&
      contribution.bytesInOutput > 0
    )
      throw new Error(`Mixed released kernel: ${p}`);
// Preserve source identity separately from built payload identity. A dirty source
// diff does not itself prove which bytes produced the build; payload hashes do.
const rootLookup = spawnSync(
  'git',
  ['-C', candidate, 'rev-parse', '--show-toplevel'],
  { encoding: 'utf8' }
);
assert.equal(rootLookup.status, 0, rootLookup.stderr);
const sourceRoot = rootLookup.stdout.trim();
const git = (args) => {
  const result = spawnSync('git', ['-C', sourceRoot, ...args], {
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
};
const sourcePath = join(out, 'candidate-source.json');
write(sourcePath, {
  head: git(['rev-parse', 'HEAD']).trim(),
  status: git(['status', '--short']),
  diff: git(['diff', '--binary', 'HEAD', '--', 'packages/kernel']),
  note: 'Source sidecar separate from built payload hashes; package version intentionally unchanged.',
});
bindings[sourcePath] = sha(sourcePath);
const candidateReceipt = join(out, 'candidate-bundles.json');
write(candidateReceipt, {
  esbuild: esbuild.version,
  bundles: { v15: bundlePath },
  bindings,
  externalAngular: core,
  candidate: true,
});
const baselineReceipt = join(baseline, 'bundles.json');
const schedule = [];
for (const rows of [1000, 10000])
  for (const fields of [8, 32])
    for (let round = 0; round < 5; round++)
      for (const variant of round % 2
        ? ['candidate', 'baseline']
        : ['baseline', 'candidate'])
        schedule.push({ arm: 'v15', rows, fields, round, repeat: 0, variant });
write(join(out, 'schedule.json'), {
  command: [process.execPath, ...process.argv.slice(1)],
  createdUTC: new Date().toISOString(),
  bindings: {
    ...originalSchedule.bindings,
    ...bindings,
    [candidateReceipt]: sha(candidateReceipt),
  },
  baselineReceipt,
  candidateReceipt,
  schedule,
});
const results = [];
for (const [index, sample] of schedule.entries()) {
  const path = join(out, `child-${String(index).padStart(3, '0')}.json`);
  const args = [
    '--expose-gc',
    runner,
    'child',
    packet,
    path,
    JSON.stringify(sample),
    sample.variant === 'candidate' ? candidateReceipt : baselineReceipt,
  ];
  const child = spawnSync(process.execPath, args, {
    encoding: 'utf8',
    env: { ...process.env, NODE_ENV: 'production' },
    timeout: 240000,
  });
  writeFileSync(path + '.log', (child.stdout ?? '') + (child.stderr ?? ''), {
    flag: 'wx',
  });
  write(join(out, `invocation-${index}.json`), {
    command: [process.execPath, ...args],
    exit: child.status,
    signal: child.signal,
    resultPath: path,
    resultSha256: existsSync(path) ? sha(path) : null,
    logSha256: sha(path + '.log'),
  });
  if (existsSync(path)) results.push(read(path));
  if (child.status !== 0 || !results.at(-1)?.passed) break;
  console.log(index, sample.variant, sample.rows, sample.fields, 'passed');
}
for (const [p, digest] of Object.entries(
  read(join(out, 'schedule.json')).bindings
))
  assert.equal(sha(p), digest, `Input drift: ${p}`);
const passed =
  results.length === schedule.length && results.every((r) => r.passed);
write(join(out, 'results.json'), {
  passed,
  scheduleSha256: sha(join(out, 'schedule.json')),
  results,
});
if (!passed) {
  process.exitCode = 1;
} else {
  const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
  const stats = (values) => ({
    median: median(values),
    min: Math.min(...values),
    max: Math.max(...values),
    values,
  });
  const groups = [];
  for (const rows of [1000, 10000])
    for (const fields of [8, 32]) {
      const base = results.filter(
        (r) =>
          r.rows === rows && r.fields === fields && r.variant === 'baseline'
      );
      const cand = results.filter(
        (r) =>
          r.rows === rows && r.fields === fields && r.variant === 'candidate'
      );
      assert.equal(base.length, 5);
      assert.equal(cand.length, 5);
      const stages = {};
      for (const s of base[0].stages) {
        const a = base.map(
            (c) => c.stages.find((x) => x.name === s.name).elapsedMs
          ),
          b = cand.map(
            (c) => c.stages.find((x) => x.name === s.name).elapsedMs
          );
        stages[s.name] = {
          baseline: stats(a),
          candidate: stats(b),
          pairedRatios: stats(b.map((v, i) => v / a[i])),
        };
      }
      const heapBytes = {};
      for (const name of Object.keys(base[0].heapBytes))
        heapBytes[name] = {
          baseline: stats(base.map((c) => c.heapBytes[name])),
          candidate: stats(cand.map((c) => c.heapBytes[name])),
          pairedDelta: stats(
            cand.map((c, i) => c.heapBytes[name] - base[i].heapBytes[name])
          ),
        };
      groups.push({ rows, fields, stages, heapBytes });
    }
  write(join(out, 'summary.json'), {
    passed: true,
    childCount: results.length,
    resultsSha256: sha(join(out, 'results.json')),
    groups,
    limits:
      'Paired unpublished kernel candidate, unchanged installed Angular facade, same ordinary long-lived fixture. State work includes common assertions; no rendering or full v16 contract comparison. Five pairs/profile, shared host. Heap is whole process, not per-feature attribution.',
  });
}
