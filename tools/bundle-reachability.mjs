#!/usr/bin/env node
/**
 * BUNDLE-REACHABILITY-0: attribute modules reachable from optional features.
 *
 * This reports static reachability and minified bytes, not semantic necessity.
 * A module appearing here is a prompt to inspect the import edge; it is not by
 * itself evidence that the edge is accidental.
 *
 * Usage: node tools/bundle-reachability.mjs [--json]
 */
import { build } from 'esbuild';
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { gzipSync } from 'node:zlib';

const ROOT = process.cwd();
const DIST = join(ROOT, 'dist/packages/kernel/dist');
const INDEX = join(DIST, 'index.js');
if (!existsSync(INDEX)) {
  console.error('build first: pnpm nx build kernel');
  process.exit(1);
}

const directory = mkdtempSync(join(tmpdir(), 'st-reachability-'));
const external = ['@angular/*', 'rxjs', 'rxjs/*', 'tslib'];
const scenarios = {
  bare: `
    import { signalTree } from ${JSON.stringify(INDEX)};
    const tree = signalTree({ count: 0, user: { name: 'a' } });
    tree.$.count(1);
    globalThis.__sink = [tree.$.count(), tree.$.user.name()];
  `,
  entityMap: `
    import { signalTree, entityMap } from ${JSON.stringify(INDEX)};
    const tree = signalTree({ rows: entityMap({ selectId: row => row.id }) });
    tree.$.rows.addOne({ id: 1, value: 0 });
    tree.$.rows.updateOne(1, { value: 1 });
    globalThis.__sink = [tree.$.rows.byId(1)?.(), tree.$.rows.all()];
  `,
  restoration: `
    import { signalTree, restoration, undoable } from ${JSON.stringify(INDEX)};
    const tree = signalTree(
      { count: 0 },
      { enhancers: [restoration({ maxHistorySize: 20 })] }
    );
    undoable(() => tree.$.count(1));
    tree.undo();
    tree.redo();
    globalThis.__sink = [tree.$.count(), tree.canUndo(), tree.canRedo()];
  `,
};

const normalize = (path) => {
  const fromDist = relative(DIST, path).replaceAll('\\', '/');
  return fromDist.startsWith('../') ? path : fromDist;
};

async function analyze(name, code) {
  const entry = join(directory, `${name}.js`);
  writeFileSync(entry, code);
  const result = await build({
    entryPoints: [entry],
    bundle: true,
    minify: true,
    format: 'esm',
    platform: 'browser',
    treeShaking: true,
    external,
    nodePaths: [join(ROOT, 'node_modules')],
    write: false,
    legalComments: 'none',
    logLevel: 'silent',
    define: { ngDevMode: 'false' },
    metafile: true,
  });
  const output = Object.values(result.metafile.outputs)[0];
  const modules = Object.entries(output.inputs)
    .filter(
      ([path]) =>
        path !== entry &&
        !path.startsWith(directory) &&
        !path.includes('st-reachability-')
    )
    .map(([path, metadata]) => ({
      path: normalize(path),
      bytes: metadata.bytesInOutput,
    }))
    .filter(({ bytes }) => bytes > 0)
    .sort((left, right) => right.bytes - left.bytes);
  const bytes = result.outputFiles[0].contents;
  return {
    minifiedBytes: bytes.length,
    gzipBytes: gzipSync(bytes, { level: 9 }).length,
    modules,
  };
}

const report = {};
for (const [name, code] of Object.entries(scenarios)) {
  report[name] = await analyze(name, code);
}

const bareBytes = new Map(
  report.bare.modules.map(({ path, bytes }) => [path, bytes])
);
for (const name of ['entityMap', 'restoration']) {
  report[name].marginalModules = report[name].modules
    .map(({ path, bytes }) => ({
      path,
      bytes: Math.max(0, bytes - (bareBytes.get(path) ?? 0)),
      newModule: !bareBytes.has(path),
    }))
    .filter(({ bytes }) => bytes > 0)
    .sort((left, right) => right.bytes - left.bytes);
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
}

for (const [name, result] of Object.entries(report)) {
  console.log(
    `\n${name}: ${(result.gzipBytes / 1024).toFixed(2)} KB gzip, ` +
      `${result.minifiedBytes} minified bytes, ${result.modules.length} modules`
  );
  if (!result.marginalModules) continue;
  console.log('  marginal reachability:');
  for (const module of result.marginalModules.slice(0, 20)) {
    console.log(
      `  ${String(module.bytes).padStart(6)} B  ` +
        `${module.newModule ? 'NEW ' : 'MORE'}  ${module.path}`
    );
  }
}
