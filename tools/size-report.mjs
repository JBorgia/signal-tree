#!/usr/bin/env node
/**
 * What a consumer actually PAYS, feature by feature.
 *
 * `check-bundle-budget.mjs` gates three fixed scenarios. This answers the wider
 * question — what does each marker, enhancer and subpath cost, and does
 * anything fail to tree-shake — so structural decisions are made on measurement
 * rather than on the shape of the source tree.
 *
 * Everything is a PRODUCTION build (`ngDevMode: false`), own code only
 * (@angular/rxjs/tslib external), gzipped. Each feature is EXERCISED, not merely
 * imported: importing a symbol and never calling it measures the tree-shaker,
 * not the feature.
 *
 * Usage: node tools/size-report.mjs [--json]
 *        (requires `nx run-many -t build --all` first)
 */
import { build } from 'esbuild';
import { gzipSync } from 'node:zlib';
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CORE = join(process.cwd(), 'dist/packages/kernel/dist/index.js');
const NM = join(process.cwd(), 'node_modules');
if (!existsSync(CORE)) {
  console.error('❌ build first: nx run-many -t build --all');
  process.exit(1);
}
const dir = mkdtempSync(join(tmpdir(), 'st-size-'));
const sub = (p) => JSON.stringify(join(process.cwd(), `dist/packages/kernel/dist/${p}`));

async function kb(code, id) {
  const entry = join(dir, `${id}.js`);
  writeFileSync(entry, code, 'utf8');
  const out = await build({
    entryPoints: [entry], bundle: true, minify: true, format: 'esm',
    platform: 'browser', treeShaking: true,
    external: ['@angular/*', 'rxjs', 'rxjs/*', 'tslib'],
    nodePaths: [NM], write: false, legalComments: 'none', logLevel: 'silent',
    define: { ngDevMode: 'false' },
  });
  return gzipSync(Buffer.from(out.outputFiles[0].contents), { level: 9 }).length / 1024;
}

const C = JSON.stringify(CORE);
const BASE = `
  import { signalTree } from ${C};
  const t = signalTree({ count: 0, user: { name: 'a' } });
  t.$.count(1); t.$.user({ name: 'b' });
  globalThis.__sink = [t.$.count(), t.$()];
`;

const MARKERS = [
  ['entityMap (plain)', 'entityMap', `
    const t = signalTree({ rows: entityMap({ selectId: (r) => r.id }) });
    t.$.rows.addOne({ id: 1 }); t.$.rows.updateOne(1, {});
    globalThis.__sink = [t.$.rows.all(), t.$.rows.count()];`],
];

const ENHANCERS = [
  ['batching', 'batching', 'batching()', 't.batch(() => t.$.count(2));'],
  [
    'restoration',
    'restoration, undoable',
    'restoration()',
    'undoable(() => t.$.count(2)); t.undo(); t.redo();',
  ],
  ['devTools', 'devTools', 'devTools()', 't.connectDevTools();'],

];

// Empty since GREENFIELD-V15-SURFACE-0: the only standalone arm measured
// `createAuditTracker`, which is no longer part of the v15 public surface.
const STANDALONE = [];

// RC-HARNESS-3. This measured `core/storage`, importing a VALUE
// (`createIndexedDBAdapter`) from a module that emits no JS — the persistence
// enhancer and `StorageAdapter` were deleted from the public v15 surface, and
// Link + endpoint is the persistence architecture now. The arm was not repaired
// by resurrecting a dead adapter; it measures the ONE subpath v15 actually
// ships instead.
const SUBPATHS = [
  [
    'kernel/adapter',
    `import { createSignalTreeFactory } from ${sub('adapter.js')};
     globalThis.__sink = createSignalTreeFactory;`,
  ],
];

const base = await kb(BASE, 'base');
const out = { baseKB: +base.toFixed(2), markers: [], enhancers: [], subpaths: [], notes: [] };

for (const [label, imports, body] of MARKERS) {
  const code = `import { signalTree, ${imports} } from ${C};\n${body}`;
  const k = await kb(code, label.replace(/\W+/g, '_'));
  out.markers.push({ feature: label, totalKB: +k.toFixed(2), deltaKB: +(k - base).toFixed(2) });
}
for (const [label, imports, apply, use] of ENHANCERS) {
  const code = `
    import { signalTree, ${imports} } from ${C};
    const t = signalTree({ count: 0 }, { enhancers: [${apply}] });
    t.$.count(1); ${use}
    globalThis.__sink = [t.$.count()];`;
  const k = await kb(code, 'enh_' + label);
  out.enhancers.push({ feature: label, totalKB: +k.toFixed(2), deltaKB: +(k - base).toFixed(2) });
}
out.standalone = [];
for (const [label, code] of STANDALONE) {
  const k = await kb(code, 'sa_' + label);
  out.standalone.push({ feature: label, totalKB: +k.toFixed(2), deltaKB: +(k - base).toFixed(2) });
}
for (const [label, code] of SUBPATHS) {
  const k = await kb(code, 'sp_' + label.replace(/\W+/g, '_'));
  out.subpaths.push({ feature: label, totalKB: +k.toFixed(2) });
}

// Realistic combinations — what an app actually ships.
const COMBOS = [
  ['typical app (entityMap + batching)', `
    import { signalTree, entityMap, batching } from ${C};
    const t = signalTree({
      rows: entityMap({ selectId: (r) => r.id }),
      count: 0,
    }, { enhancers: [batching()] });
    t.batch(() => { t.$.rows.addOne({ id: 1 }); t.$.count(1); });
    globalThis.__sink = [t.$.rows.all(), t.$.count()];`],
  ['current public surface mix', `
    import { signalTree, entityMap,
             batching, restoration, undoable } from ${C};
    const t = signalTree({
      rows: entityMap({ selectId: (r) => r.id }),
      count: 0,
    }, { enhancers: [batching(), restoration()] });
    undoable(() => t.batch(() => {
      t.$.rows.addOne({ id: 1 }); t.$.count(1);
    }));
    t.undo(); t.redo();
    globalThis.__sink = [t.$.rows.all(), t.$.count()];`],
];
out.combos = [];
for (const [label, code] of COMBOS) {
  const k = await kb(code, 'combo_' + label.replace(/\W+/g, '_'));
  out.combos.push({ feature: label, totalKB: +k.toFixed(2), deltaKB: +(k - base).toFixed(2) });
}

/**
 * A measured size of ~zero means the build is empty, not that the library is
 * free.
 *
 * The only guard here was `existsSync` on the built barrel, and an EMPTY file
 * exists. A truncated or failed build therefore produced a size table full of
 * near-zero numbers and exited 0 — a reporter's worst failure mode, because the
 * output looks like a spectacular result rather than a broken run.
 */
if (!(base > 0.5)) {
  console.error(
    `\n✗ the bare signalTree bundle measured ${base.toFixed(2)}KB gzip.\n` +
      `  That is not a real measurement — the built barrel is empty or truncated.\n` +
      `  Rebuild with \`nx run-many -t build --all\` before trusting any number here.`
  );
  process.exit(1);
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(out, null, 2));
} else {
  const row = (r) =>
    `  ${r.feature.padEnd(38)} ${String(r.totalKB.toFixed(2)).padStart(6)} KB` +
    (r.deltaKB === undefined ? '' : `   +${r.deltaKB.toFixed(2)}`);
  console.log('Production (ngDevMode:false), own code only, gzipped\n');
  console.log(`  ${'bare signalTree'.padEnd(38)} ${base.toFixed(2).padStart(6)} KB\n`);
  console.log('MARKERS (delta over bare)');
  out.markers.forEach((r) => console.log(row(r)));
  console.log('\nENHANCERS (delta over bare)');
  out.enhancers.forEach((r) => console.log(row(r)));
  console.log('\nSTANDALONE HELPERS (delta over bare)');
  out.standalone.forEach((r) => console.log(row(r)));
  console.log('\nSUBPATH, imported alone');
  out.subpaths.forEach((r) => console.log(row(r)));
  console.log('\nREALISTIC COMBINATIONS');
  out.combos.forEach((r) => console.log(row(r)));
  // The widest current combo uses plain entityMap plus batching and restoration.
  // Add exactly those individual deltas; omitting entityMap made the measured
  // combo look larger than its own supposed additive total.
  const additive =
    out.markers
      .filter((r) => r.feature === 'entityMap (plain)')
      .reduce((a, r) => a + r.deltaKB, 0) +
    out.enhancers
      .filter((r) => ['batching', 'restoration'].includes(r.feature))
      .reduce((a, r) => a + r.deltaKB, 0);
  // PRE-EXISTING: this looked up a combo named 'everything' that COMBOS has not
  // contained for some time, so the reporter crashed on its own last line with
  // `Cannot read properties of undefined`. Found while re-running the
  // benchmarks for the 15.0 declarative-construction migration; unrelated to it.
  // Compare against the widest combo that actually exists rather than inventing
  // one, and say which combo the sharing figure is about.
  const widest = out.combos.reduce(
    (a, c) => (a && a.deltaKB >= c.deltaKB ? a : c),
    undefined
  );
  if (widest) {
    console.log(
      `\n  If every feature's cost were additive, "${widest.feature}" would be ` +
        `+${additive.toFixed(2)} KB.\n  Measured: +${widest.deltaKB.toFixed(2)} KB — about ` +
        `${(additive - widest.deltaKB).toFixed(2)} KB of shared machinery.\n` +
        `  A combo much LARGER than additive would mean something is NOT being shared.`
    );
  }
  console.log('\n  Analysis: docs/architecture/size-structure-review.md');
}
