#!/usr/bin/env node
/**
 * THE v14 <-> v15 ECONOMIC CONTROL — shipped 14.1.x against current 15.x.
 *
 * ## Why this exists
 *
 * Every v14 performance figure in this repository's architecture discussion has
 * been unsourced. `release/14.x` has no benchmark harness of its own, so claims
 * like "v14 was ~132 B/entity" or "v15 setAll is 6x slower" were compared
 * against numbers nobody could regenerate. `tools/bench-entity-realization-matrix.mjs`
 * closed that hole for retained memory. This closes it for CPU.
 *
 * The comparison is Angular-native on BOTH sides, which is the only fair one:
 * v14 `@signaltree/core` is Angular-native by construction, and v15's Angular
 * package exposes native `WritableSignal` carriers. Both arms are driven by the
 * same workload source with no compatibility shim — probed and confirmed
 * identical for read, `.set()`, `byId().field()`, `updateOne`, `setAll` and
 * `destroy()`. A shim would itself be a bias source.
 *
 * ## Protocol, and the errors it exists to prevent
 *
 * `docs/architecture/v15-performance-baseline.md` records that one unchanged
 * build measured `setAll` at 17.5, 18.6, 27.1, 30.2, 49.6 and 66.1 ms — a 3.8x
 * spread with no code between runs. A sequential before/after produced a 21%
 * regression that vanished under interleaving, and later a 30% "improvement" in
 * the other direction. Therefore:
 *
 *   - arms are INTERLEAVED inside one process, and the order flips every round,
 *     so drift and warmup cannot accumulate onto one side;
 *   - an A/A control runs v15 against itself through the identical path, so
 *     protocol noise is visible rather than assumed;
 *   - the median AND the spread are reported. A result whose arms overlap the
 *     A/A band is not a result.
 *
 * Provenance for both sides — git SHA, package version, Node, platform — is
 * printed with every run, because a number without its build is not evidence.
 *
 *   pnpm nx run-many -t build --projects=kernel,angular,react,vue
 *   (in the v14 checkout)  npx nx build core
 *   node tools/bench-v14-v15-control.mjs
 *   node tools/bench-v14-v15-control.mjs --rounds 9 --json
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
import { hostname, platform, arch, cpus } from 'node:os';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const argument = (name, fallback) => {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1];
};

const ROUNDS = Number(argument('--rounds', 7));
const JSON_ONLY = process.argv.includes('--json');
const V14_ROOT = resolve(ROOT, argument('--v14-root', '../signaltree-14x'));

const ARMS = [
  {
    arm: 'v15',
    spec: '@signal-tree/angular',
    dist: join(ROOT, 'dist/packages/angular'),
    repo: ROOT,
  },
  {
    arm: 'v14',
    spec: '@signaltree/core',
    dist: join(V14_ROOT, 'dist/packages/core'),
    repo: V14_ROOT,
  },
];

/** Also copied so `@signal-tree/angular` can resolve its own kernel import. */
const SUPPORT = [
  { spec: '@signal-tree/kernel', dist: join(ROOT, 'dist/packages/kernel') },
];
const RUNTIME_DEPS = ['@angular/core', 'rxjs', 'tslib'];

function provenance(entry) {
  const git = (args) => {
    try {
      return execFileSync('git', args, {
        cwd: entry.repo,
        encoding: 'utf8',
      }).trim();
    } catch {
      return 'unknown';
    }
  };
  let version = 'unknown';
  try {
    version = JSON.parse(
      execFileSync('cat', [join(entry.dist, 'package.json')], {
        encoding: 'utf8',
      })
    ).version;
  } catch {
    /* reported as unknown */
  }
  return {
    arm: entry.arm,
    spec: entry.spec,
    version,
    sha: git(['rev-parse', '--short', 'HEAD']),
    branch: git(['rev-parse', '--abbrev-ref', 'HEAD']),
    dirty: git(['status', '--porcelain']).length > 0,
  };
}

function buildConsumerRoot() {
  const root = join(tmpdir(), `signaltree-v14-v15-control-${process.pid}`);
  rmSync(root, { recursive: true, force: true });
  mkdirSync(join(root, 'node_modules'), { recursive: true });
  writeFileSync(join(root, 'package.json'), '{"type":"module"}');

  for (const entry of [...ARMS, ...SUPPORT]) {
    if (!existsSync(join(entry.dist, 'dist/index.js'))) {
      throw new Error(
        `missing build for ${entry.spec} at ${entry.dist}\n` +
          `  v15: pnpm nx run-many -t build --projects=kernel,angular,react,vue\n` +
          `  v14: npx nx build core   (in ${V14_ROOT})`
      );
    }
    const to = join(root, 'node_modules', entry.spec);
    mkdirSync(dirname(to), { recursive: true });
    cpSync(entry.dist, to, { recursive: true });
  }
  // Symlinked, not copied: copying a pnpm package detaches it from the `.pnpm`
  // store its own internal imports resolve through. Both arms must also see the
  // SAME `@angular/core` instance, or they are not comparable.
  for (const dep of RUNTIME_DEPS) {
    const from = join(ROOT, 'node_modules', dep);
    if (!existsSync(from)) continue;
    const to = join(root, 'node_modules', dep);
    mkdirSync(dirname(to), { recursive: true });
    symlinkSync(from, to);
  }
  writeFileSync(join(root, 'run.mjs'), RUNNER);
  return root;
}

const RUNNER = String.raw`
const arg = (n, f) => { const i = process.argv.indexOf(n); return i === -1 ? f : process.argv[i + 1]; };
const rounds = Number(arg('--rounds', 7));
const aaControl = process.argv.includes('--aa');

const specs = aaControl
  ? { a: '@signal-tree/angular', b: '@signal-tree/angular' }
  : { a: '@signal-tree/angular', b: '@signaltree/core' };

const mods = {
  a: await import(specs.a),
  b: await import(specs.b),
};

const seed = (n) => { const d = []; for (let i = 0; i < n; i++) d.push({ id: i, name: 'n' + i, v: i }); return d; };
const now = () => Number(process.hrtime.bigint());

/**
 * Each workload returns ns/op. Every one asserts its work landed — a benchmark
 * that silently measures a no-op is the failure mode this repo has shipped
 * before.
 */
const WORKLOADS = {
  'scalar-read': (m) => {
    const t = m.signalTree({ count: 0 });
    t.$.count.set(1);
    const ops = 3000000;
    for (let i = 0; i < 300000; i++) t.$.count();      // warmup
    const s = now();
    let sink = 0;
    for (let i = 0; i < ops; i++) sink += t.$.count();
    const e = now();
    if (sink !== ops) throw new Error('scalar-read did not land');
    t.destroy?.();
    return (e - s) / ops;
  },
  'scalar-set': (m) => {
    const t = m.signalTree({ count: 0 });
    const ops = 3000000;
    for (let i = 0; i < 300000; i++) t.$.count.set(i);  // warmup
    const s = now();
    for (let i = 0; i < ops; i++) t.$.count.set(i);
    const e = now();
    if (t.$.count() !== ops - 1) throw new Error('scalar-set did not land');
    t.destroy?.();
    return (e - s) / ops;
  },
  'construct-100': (m) => {
    const shape = () => { const o = {}; for (let i = 0; i < 100; i++) o['k' + i] = i; return o; };
    const ops = 200;
    for (let i = 0; i < 20; i++) { const t = m.signalTree(shape()); t.destroy?.(); }
    const s = now();
    let last;
    for (let i = 0; i < ops; i++) { last = m.signalTree(shape()); last.destroy?.(); }
    const e = now();
    if (last === undefined) throw new Error('construct-100 did not land');
    return (e - s) / ops;
  },
  'construct-1000': (m) => {
    const shape = () => { const o = {}; for (let i = 0; i < 1000; i++) o['k' + i] = i; return o; };
    const ops = 30;
    for (let i = 0; i < 5; i++) { const t = m.signalTree(shape()); t.destroy?.(); }
    const s = now();
    let last;
    for (let i = 0; i < ops; i++) { last = m.signalTree(shape()); last.destroy?.(); }
    const e = now();
    if (last === undefined) throw new Error('construct-1000 did not land');
    return (e - s) / ops;
  },
  'entity-setAll-10k': (m) => {
    const ops = 5;
    const cfg = { selectId: (r) => r.id };
    const data = seed(10000);
    for (let i = 0; i < 2; i++) { const t = m.signalTree({ rows: m.entityMap(cfg) }); t.$.rows.setAll(data); t.destroy?.(); }
    const s = now();
    let count = 0;
    for (let i = 0; i < ops; i++) {
      const t = m.signalTree({ rows: m.entityMap(cfg) });
      t.$.rows.setAll(data);
      count += t.$.rows.ids().length;
      t.destroy?.();
    }
    const e = now();
    if (count !== ops * 10000) throw new Error('entity-setAll did not land');
    return (e - s) / ops;
  },
  'entity-updateOne-10k': (m) => {
    const cfg = { selectId: (r) => r.id };
    const t = m.signalTree({ rows: m.entityMap(cfg) });
    t.$.rows.setAll(seed(10000));
    const ops = 200000;
    for (let i = 0; i < 20000; i++) t.$.rows.updateOne(i % 10000, { v: i });
    const s = now();
    for (let i = 0; i < ops; i++) t.$.rows.updateOne(i % 10000, { v: i });
    const e = now();
    if (t.$.rows.byId(0) === undefined) throw new Error('entity-updateOne did not land');
    t.destroy?.();
    return (e - s) / ops;
  },
  'entity-byId-field-read': (m) => {
    const cfg = { selectId: (r) => r.id };
    const t = m.signalTree({ rows: m.entityMap(cfg) });
    t.$.rows.setAll(seed(10000));
    const ops = 200000;
    for (let i = 0; i < 20000; i++) void t.$.rows.byId(i % 10000)?.name();
    const s = now();
    let sink = 0;
    for (let i = 0; i < ops; i++) sink += t.$.rows.byId(i % 10000)?.name() ? 1 : 0;
    const e = now();
    if (sink !== ops) throw new Error('entity-byId-field-read did not land');
    t.destroy?.();
    return (e - s) / ops;
  },
};

const samples = { a: {}, b: {} };
for (const name of Object.keys(WORKLOADS)) { samples.a[name] = []; samples.b[name] = []; }

/**
 * Collect between every measurement. The construction arms allocate and drop
 * hundreds of trees per sample, and without this the garbage from one arm is
 * collected during the next one — which showed up as a +-26% A/A band on
 * construct-100 while the steady-state arms sat at +-1-2%. The A/A control is
 * what made that visible; do not remove this without re-reading that band.
 */
const settle = () => {
  if (typeof globalThis.gc === 'function') {
    globalThis.gc();
    globalThis.gc();
  }
};

for (let round = 0; round < rounds; round++) {
  for (const name of Object.keys(WORKLOADS)) {
    // Flip which side goes first every round so drift cannot accumulate on one.
    const order = round % 2 === 0 ? ['a', 'b'] : ['b', 'a'];
    for (const side of order) {
      settle();
      samples[side][name].push(WORKLOADS[name](mods[side]));
    }
  }
}
console.log(JSON.stringify({ aaControl, samples }));
`;

function run(root, { aa }) {
  const out = execFileSync(
    process.execPath,
    [
      '--expose-gc',
      'run.mjs',
      '--rounds',
      String(ROUNDS),
      ...(aa ? ['--aa'] : []),
    ],
    { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }
  );
  return JSON.parse(out.trim().split('\n').at(-1));
}

const median = (xs) => {
  const s = [...xs].sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)];
};
const fmt = (ns) =>
  ns >= 1e6
    ? `${(ns / 1e6).toFixed(2)} ms`
    : ns >= 1e3
    ? `${(ns / 1e3).toFixed(2)} us`
    : `${ns.toFixed(1)} ns`;

const root = buildConsumerRoot();
let real;
let aa;
try {
  real = run(root, { aa: false });
  aa = run(root, { aa: true });
} finally {
  rmSync(root, { recursive: true, force: true });
}

const prov = ARMS.map(provenance);

if (JSON_ONLY) {
  console.log(
    JSON.stringify({ rounds: ROUNDS, provenance: prov, real, aa }, null, 2)
  );
  process.exit(0);
}

console.log(`\nv14 <-> v15 ECONOMIC CONTROL — interleaved, ${ROUNDS} rounds\n`);
for (const p of prov) {
  console.log(
    `  ${p.arm.padEnd(4)} ${p.spec.padEnd(22)} ${String(p.version).padEnd(9)} ${
      p.sha
    } ${p.branch}${p.dirty ? ' (dirty)' : ''}`
  );
}
console.log(
  `  node ${process.version}  ${platform()}/${arch()}  ${
    cpus()[0]?.model ?? 'unknown cpu'
  }  ${hostname()}`
);

console.log(
  `\n  workload                    v15         v14      ratio   A/A band (v15 vs itself)`
);
console.log(`  ${'-'.repeat(82)}`);
for (const name of Object.keys(real.samples.a)) {
  const v15 = median(real.samples.a[name]);
  const v14 = median(real.samples.b[name]);
  const aaA = median(aa.samples.a[name]);
  const aaB = median(aa.samples.b[name]);
  const aaSkew = Math.abs(aaA / aaB - 1) * 100;
  const ratio = v15 / v14;
  console.log(
    `  ${name.padEnd(24)} ${fmt(v15).padStart(9)} ${fmt(v14).padStart(
      11
    )} ${ratio.toFixed(2).padStart(7)}x   +-${aaSkew.toFixed(1)}%`
  );
}

console.log(
  `\n  Ratios inside the A/A band are NOT results — that column is this protocol's`
);
console.log(
  `  own noise, measured by running v15 against itself through the same path.`
);
console.log(
  `  v14 semantics are WEAKER (keys are identity; a held node follows a fresh`
);
console.log(
  `  same-key occupant). Treat v14 as an economic floor, never as a target.\n`
);
