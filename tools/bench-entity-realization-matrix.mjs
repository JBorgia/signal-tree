#!/usr/bin/env node
/**
 * ENTITY REALIZATION DENSITY, PER FRAMEWORK — the arm that did not exist.
 *
 * ## The defect that earned this
 *
 * `tools/bench-entity-layers.mjs` imports only `dist/packages/kernel`. It never
 * loads a framework and never binds an observation adapter, so
 * `createEntitySignal` falls through to
 * `options?.locationRuntime ?? NEUTRAL_LOCATION_RUNTIME` (`entity-signal.ts:310`)
 * and every L-arm measures the framework-neutral projection in
 * `internals/location-runtime.ts`.
 *
 * That is a configuration no Angular or Vue application runs. `REALIZATION-
 * DENSITY-REGRESSION-0` was bisected, attributed and written up entirely on it,
 * and a first draft of that write-up blamed Angular's `linkedSignal` for a
 * number taken with Angular absent from the process.
 *
 * The carrier decision's own density arm
 * (`docs/performance/framework-native-leaves.md`) does not close the hole: it
 * measures 100k SCALAR leaves. No arm anywhere measured entity node/field
 * realization through a real adapter, in any framework.
 *
 * ## What it does
 *
 * The same fixture, the same quiescence protocol and the same three arm
 * definitions as `bench-entity-layers.mjs`, run once per framework package.
 * Only the source of `signalTree` changes — that is, only which runtime answers
 * the realization seam.
 *
 *   untouched  <-> L4-public-entitymap   tree held, nothing realized
 *   realized   <-> byId + one field read on every row, then all released
 *   held       <-> L5-nodes-held         byId on every row, nodes held
 *
 * The `kernel` row is the control: it must reproduce `bench-entity-layers.mjs`,
 * and if it does not, this harness is wrong rather than the product.
 *
 * Each cell runs in its own process in a temporary consumer root. The
 * `@signal-tree/*` packages are COPIED there, because Node resolves a symlinked
 * module's bare imports from its realpath — a symlinked `@signal-tree/angular`
 * resolves its own `@signal-tree/kernel` import back through the workspace
 * `node_modules`, silently measuring a different build. Framework runtimes are
 * SYMLINKED for the mirror-image reason: copying a pnpm package detaches it
 * from the `.pnpm` store its internal imports resolve through, and `vue` then
 * fails to provide `isProxy`.
 *
 *   pnpm nx run-many -t build --projects=kernel,angular,react,vue
 *   node --expose-gc tools/bench-entity-realization-matrix.mjs
 *   node --expose-gc tools/bench-entity-realization-matrix.mjs --n 10000 --json
 */
import { execFileSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const argument = (name, fallback) => {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1];
};

const N = Number(argument('--n', 10000));
const JSON_ONLY = process.argv.includes('--json');

/**
 * The v14 row is the ECONOMIC control: `@signaltree/core@14.1.x`, the shipped
 * Angular-native line, built from its own checkout. It is the only row that is
 * not v15 lineage, and the only answer to "what did this cost before the
 * kernel/adapter split". Every v14 figure quoted in this repository's history
 * has been unsourced because no v14 arm existed anywhere. This is that arm.
 *
 * It is NOT a fair fight on semantics and must never be quoted as one. In v14
 * the key IS the identity: remove and re-add key 42 and a held node follows the
 * new occupant. v15 guarantees the opposite, and `entity-physical-density.md`
 * E0 attributes most of the physical difference to exactly that guarantee.
 * Treat this row as a floor, not a target.
 */
const V14_ROOT = resolve(ROOT, argument('--v14-root', '../signaltree-14x'));

const ROWS = [
  {
    row: 'kernel',
    spec: '@signal-tree/kernel',
    dist: join(ROOT, 'dist/packages/kernel'),
    note: 'neutral control',
  },
  {
    row: 'angular',
    spec: '@signal-tree/angular',
    dist: join(ROOT, 'dist/packages/angular'),
    note: 'Angular adapter',
  },
  {
    row: 'vue',
    spec: '@signal-tree/vue',
    dist: join(ROOT, 'dist/packages/vue'),
    note: 'Vue adapter',
  },
  {
    row: 'react',
    spec: '@signal-tree/react',
    dist: join(ROOT, 'dist/packages/react'),
    note: 'no adapter by design',
  },
  {
    row: 'v14',
    spec: '@signaltree/core',
    dist: join(V14_ROOT, 'dist/packages/core'),
    note: 'v14 control — WEAKER semantics, see header',
    optional: true,
    buildHint: `npx nx build core   (in ${V14_ROOT})`,
  },
];
const CELLS = ['untouched', 'realized', 'held'];

/** Framework runtimes the built packages import as bare specifiers. */
const RUNTIME_DEPS = ['@angular/core', 'vue', 'react', 'rxjs', 'tslib'];

/** Rows whose build is present. An absent optional row is skipped, not fatal. */
function availableRows() {
  const available = [];
  for (const entry of ROWS) {
    if (existsSync(join(entry.dist, 'dist/index.js'))) {
      available.push(entry);
    } else if (entry.optional) {
      console.error(
        `  (skipping row "${entry.row}" — no build at ${entry.dist}; ${entry.buildHint})`
      );
    } else {
      throw new Error(
        `missing build for ${entry.row} — run: pnpm nx run-many -t build --projects=kernel,angular,react,vue`
      );
    }
  }
  return available;
}

function buildConsumerRoot(rows) {
  const root = join(tmpdir(), `signaltree-realization-matrix-${process.pid}`);
  rmSync(root, { recursive: true, force: true });
  mkdirSync(join(root, 'node_modules'), { recursive: true });
  writeFileSync(join(root, 'package.json'), '{"type":"module"}');

  for (const { spec, dist } of rows) {
    const to = join(root, 'node_modules', spec);
    mkdirSync(dirname(to), { recursive: true });
    cpSync(dist, to, { recursive: true });
  }
  // Framework runtimes are SYMLINKED, not copied. Copying a pnpm package
  // detaches it from the `.pnpm` store its own internal imports resolve
  // through — `vue` then fails to provide `isProxy`. A symlink is safe here
  // for the same reason it was unsafe for `@signal-tree/*`: resolving from the
  // realpath lands in the workspace, which is exactly where these belong.
  for (const dep of RUNTIME_DEPS) {
    const from = join(ROOT, 'node_modules', dep);
    if (!existsSync(from)) continue;
    const to = join(root, 'node_modules', dep);
    mkdirSync(dirname(to), { recursive: true });
    symlinkSync(from, to);
  }
  writeFileSync(join(root, 'cell.mjs'), CELL_SOURCE);
  return root;
}

const CELL_SOURCE = `
import { measureRetained, requireExposeGc } from ${JSON.stringify(
  join(ROOT, 'tools/lib/heap-quiescence.mjs')
)};
requireExposeGc('entity-realization-matrix cell');
const arg = (n, f) => { const i = process.argv.indexOf(n); return i === -1 ? f : process.argv[i + 1]; };
const row = arg('--row', 'kernel');
const spec = arg('--spec', '@signal-tree/kernel');
const cell = arg('--cell', 'held');
const n = Number(arg('--n', 10000));
const { signalTree, entityMap } = await import(spec);
const cfg = { selectId: (r) => r.id };
const seed = (count) => { const d = []; for (let i = 0; i < count; i++) d.push({ id: i, name: 'n' + i, v: i }); return d; };
const build = () => {
  const t = signalTree({ rows: entityMap(cfg) });
  t.$.rows.setAll(seed(n));
  if (cell === 'untouched') return { t };
  if (cell === 'realized') {
    for (let i = 0; i < n; i++) { const node = t.$.rows.byId(i); void node?.name(); }
    return { t };
  }
  if (cell === 'held') {
    const nodes = [];
    for (let i = 0; i < n; i++) nodes.push(t.$.rows.byId(i));
    return { t, nodes };
  }
  throw new Error('unknown cell ' + cell);
};
const r = await measureRetained(build, { label: row + '/' + cell });
console.log(JSON.stringify({
  row, cell, n,
  retainedMB: Number(r.retainedMB.toFixed(2)),
  bytesPerEntity: Math.round(r.retainedBytes / n),
  collectable: r.collectable,
}));
`;

function runCell(root, { row, spec }, cell) {
  const out = execFileSync(
    process.execPath,
    [
      '--expose-gc',
      'cell.mjs',
      '--row',
      row,
      '--spec',
      spec,
      '--cell',
      cell,
      '--n',
      String(N),
    ],
    { cwd: root, encoding: 'utf8' }
  );
  const last = out.trim().split('\n').at(-1);
  return JSON.parse(last);
}

const rows = availableRows();
const root = buildConsumerRoot(rows);
const results = [];
try {
  for (const entry of rows) {
    for (const cell of CELLS) results.push(runCell(root, entry, cell));
  }
} finally {
  rmSync(root, { recursive: true, force: true });
}

if (JSON_ONLY) {
  console.log(JSON.stringify({ n: N, results }, null, 2));
  process.exit(results.every((r) => r.collectable) ? 0 : 1);
}

const at = (row, cell) =>
  results.find((r) => r.row === row && r.cell === cell)?.bytesPerEntity;

console.log(
  `\nENTITY REALIZATION DENSITY BY FRAMEWORK — ${N.toLocaleString()} entities, 3 fields each`
);
console.log(
  'same fixture, arms and quiescence protocol as tools/bench-entity-layers.mjs;'
);
console.log('only the runtime answering the realization seam differs\n');
console.log(
  '  row       untouched   field realized   nodes held   what supplies realization'
);
console.log(`  ${'-'.repeat(94)}`);
for (const { row, note } of rows) {
  console.log(
    `  ${row.padEnd(9)} ${String(at(row, 'untouched')).padStart(9)} B ${String(
      at(row, 'realized')
    ).padStart(14)} B ${String(at(row, 'held')).padStart(12)} B   ${note}`
  );
}

const neutral = at('kernel', 'held');
console.log(
  `\n  Held realization against the neutral control (${neutral} B/entity):`
);
for (const { row } of rows.filter((entry) => entry.row !== 'kernel')) {
  const value = at(row, 'held');
  const delta = ((value / neutral - 1) * 100).toFixed(0);
  console.log(
    `    ${row.padEnd(9)} ${String(value).padStart(6)} B  ${
      delta >= 0 ? '+' : ''
    }${delta}%`
  );
}

const v14 = at('v14', 'held');
if (v14 !== undefined) {
  console.log(`\n  Against the v14 economic control (${v14} B/entity held):`);
  for (const { row } of rows.filter(
    (entry) => entry.row !== 'v14' && entry.row !== 'kernel'
  )) {
    const value = at(row, 'held');
    console.log(
      `    ${row.padEnd(9)} ${String(value).padStart(6)} B  ${(
        value / v14
      ).toFixed(2)}x`
    );
  }
  console.log(
    '\n  v14 keys ARE identity — a held node follows a new occupant of the same'
  );
  console.log(
    '  key. v15 guarantees the opposite and pays for it. This row is a FLOOR,'
  );
  console.log('  not a target; do not quote the ratio without that sentence.');
}

console.log(
  '\n  The `kernel` row is the control and must match bench-entity-layers.mjs.'
);
console.log(
  '  A framework row at exactly the control value is running the neutral'
);
console.log('  fallback, not a native realization.\n');

const uncollectable = results.filter((r) => !r.collectable);
if (uncollectable.length) {
  console.error(
    `❌ ${uncollectable.length} cell(s) did not release: ` +
      uncollectable.map((r) => `${r.row}/${r.cell}`).join(', ')
  );
  process.exit(1);
}
console.log(`  ${results.length}/${results.length} cells completed\n`);
