#!/usr/bin/env node
/**
 * PAIRED A/B BETWEEN SIGNALTREE BUILDS — v3, calibrated measurement duration.
 *
 * ## What changed from v2, and why only this
 *
 * v2 timed a fixed operation count per process. Twenty identical runs of the
 * same build on `field-read-held` produced a sharp floor near 40 ns with a 3x
 * tail: the per-process distribution is MULTI-MODAL. Its cause is not
 * established — core placement, frequency state, V8 tiering, GC and process
 * startup are all candidates — so nothing here is designed around a theory of
 * it.
 *
 * The one effect the data supports is DURATION. `setAll-reused`, at ~124 ms of
 * measured time per sample, resolved at 2.2% A/A while every workload measuring
 * under ~50 ms failed its gate. So v3 makes each timed window long enough to
 * amortise whatever per-process state dominates the short ones, and changes
 * nothing about winner selection.
 *
 * MINIMUM-OF-N IS DELIBERATELY NOT USED. It selects the luckiest execution,
 * estimates a best-case floor rather than typical cost, and structurally
 * favours implementations with wider variance. The statistic stays a median, at
 * both levels.
 *
 * Per child process:
 *
 *   setup  ->  untimed warmup  ->  CALIBRATE iteration count for the target
 *   duration  ->  5 timed batches  ->  process result = median batch ns/op
 *
 * The count is calibrated at runtime and never hard-coded, so a faster
 * candidate does not get a shorter measurement window than a slower one.
 *
 *   node tools/bench-build-ab-v3.mjs --roots a=<dist>,b=<dist> [--pairs 10]
 */
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (n, f) => { const i = process.argv.indexOf(n); return i === -1 ? f : process.argv[i + 1]; };
const PAIRS = Number(arg('--pairs', 10));
const AA_THRESHOLD = Number(arg('--aa-threshold', 5));
const BATCHES = Number(arg('--batches', 5));
const ROOTS = (arg('--roots', '') || '').split(',').filter(Boolean).map((e) => {
  const [label, path] = e.split('=');
  if (!label || !path) throw new Error(`bad --roots entry: ${e}`);
  return { label, path: resolve(path) };
});
const RUNTIME_DEPS = ['@angular', 'rxjs', 'zone.js', 'tslib'];

/**
 * `setup` runs untimed. `batch` performs `N` units. `units` is how many logical
 * operations one unit represents, so a round that realizes 10,000 rows reports
 * per-row cost rather than per-round.
 */
const WORKLOADS = {
  'updateOne': { targetMs: 250, units: 1,
    setup: `t.$.rows.setAll(seed(10000)); for (let i=0;i<20000;i++) t.$.rows.updateOne(i%10000,{v:i});`,
    batch: `for (let i=0;i<N;i++) t.$.rows.updateOne(i%10000,{v:i});` },
  'byId-warm': { targetMs: 250, units: 1,
    setup: `t.$.rows.setAll(seed(10000)); for (let i=0;i<10000;i++) void t.$.rows.byId(i)?.(); for (let i=0;i<20000;i++) void t.$.rows.byId(i%10000);`,
    batch: `for (let i=0;i<N;i++) void t.$.rows.byId(i%10000);` },
  'byId-cold': { targetMs: 250, units: 10000,
    setup: `;`,
    batch: `for (let r=0;r<N;r++){ const f=m.signalTree({rows:m.entityMap(cfg)}); f.$.rows.setAll(seed(10000)); for (let i=0;i<10000;i++) void f.$.rows.byId(i)?.(); f.destroy?.(); }` },
  'field-read-held': { targetMs: 500, units: 1,
    setup: `t.$.rows.setAll(seed(10000)); globalThis.__held=[]; for(let i=0;i<10000;i++) globalThis.__held.push(t.$.rows.byId(i)); for (let i=0;i<20000;i++) void globalThis.__held[i%10000].name();`,
    batch: `const h=globalThis.__held; for (let i=0;i<N;i++) void h[i%10000].name();` },
  'setAll-reused': { targetMs: 250, units: 1,
    setup: `for (let i=0;i<5;i++) t.$.rows.setAll(seed(10000));`,
    batch: `for (let i=0;i<N;i++) t.$.rows.setAll(seed(10000));` },
  'scalar-set': { targetMs: 500, units: 1,
    setup: `globalThis.__t2 = m.signalTree({ a: 0 }); for (let i=0;i<50000;i++) globalThis.__t2.$.a(i);`,
    batch: `const s=globalThis.__t2.$.a; for (let i=0;i<N;i++) s(i);` },
};

const CELL = (w) => `
const m = await import('@signal-tree/angular');
const now = () => Number(process.hrtime.bigint()) / 1e6;
const seed = (n) => { const d=[]; for(let i=0;i<n;i++) d.push({id:i,name:'n'+i,v:i}); return d; };
const cfg = { selectId: (r) => r.id };
const t = m.signalTree({ rows: m.entityMap(cfg) });
const TARGET = ${w.targetMs}, UNITS = ${w.units}, BATCHES = ${BATCHES};
${w.setup}
// Long, ugly timer name on purpose: workload bodies declare their own locals
// and a short one collides with them at parse time.
const run = (N) => { const __t0 = now(); ${w.batch} ; return now() - __t0; };

// Untimed warmup at a small size, so calibration does not measure cold code.
run(Math.max(1, Math.round(1000 / UNITS)));

// CALIBRATE: grow N until one batch reaches the target duration. Never
// hard-coded — a faster build must not get a shorter measurement window.
let N = Math.max(1, Math.round(1000 / UNITS));
let elapsed = run(N);
for (let guard = 0; guard < 40 && elapsed < TARGET; guard++) {
  const factor = elapsed > 1 ? Math.min(8, (TARGET / elapsed) * 1.2) : 8;
  N = Math.max(N + 1, Math.round(N * factor));
  elapsed = run(N);
}

const perOp = [];
for (let b = 0; b < BATCHES; b++) perOp.push((run(N) * 1e6) / (N * UNITS));
perOp.sort((x, y) => x - y);
const mid = perOp.length >> 1;
const median = perOp.length % 2 ? perOp[mid] : (perOp[mid - 1] + perOp[mid]) / 2;
console.log(JSON.stringify({ ns: median, N, batchMs: elapsed }));
`;

function makeRoot(distRoot) {
  const root = mkdtempSync(join(tmpdir(), 'st-ab3-'));
  mkdirSync(join(root, 'node_modules/@signal-tree'), { recursive: true });
  for (const pkg of ['kernel', 'angular']) {
    cpSync(join(distRoot, pkg), join(root, `node_modules/@signal-tree/${pkg}`), { recursive: true });
  }
  for (const dep of RUNTIME_DEPS) {
    const from = join(ROOT, 'node_modules', dep);
    if (!existsSync(from)) continue;
    const to = join(root, 'node_modules', dep);
    mkdirSync(dirname(to), { recursive: true });
    symlinkSync(from, to);
  }
  writeFileSync(join(root, 'package.json'), '{"type":"module"}');
  return root;
}

/**
 * The cell file is written ONCE per (build, workload), not per launch.
 *
 * Writing it on every invocation meant ~60 file creations per workload, and on
 * a managed host each one is a file an endpoint scanner opens and inspects.
 * Defender was observed at 196% of a core during a run. A benchmark should not
 * generate the interference it is then unable to measure through.
 */
const written = new Set();
const run = (root, name) => {
  const file = join(root, `w-${name}.mjs`);
  const key = `${root}:${name}`;
  if (!written.has(key)) { writeFileSync(file, CELL(WORKLOADS[name])); written.add(key); }
  return JSON.parse(execFileSync(process.execPath, [file], { cwd: root, encoding: 'utf8' }).trim());
};
const median = (xs) => { const s=[...xs].sort((a,b)=>a-b); const m=s.length>>1; return s.length%2?s[m]:(s[m-1]+s[m])/2; };

if (ROOTS.length < 2) { console.error('usage: --roots ref=<dist>,cand=<dist>[,...]'); process.exit(2); }
const prepared = ROOTS.map((b) => ({ ...b, root: makeRoot(b.path) }));
const [reference, ...candidates] = prepared;

console.log(`v3 calibrated paired A/B — ${PAIRS} pairs per order, both orders, ${BATCHES} batches/process`);
for (const b of prepared) console.log(`  ${b.label.padEnd(10)} ${b.path}`);
console.log(`\nreference = ${reference.label}; A/A rejection threshold ${AA_THRESHOLD}% of median`);
console.log('Iteration counts are calibrated per process to >=250ms (500ms for the');
console.log('cheapest ops). Statistic is a MEDIAN at both levels: min-of-N is not used.\n');

const head = ['workload'.padEnd(17), reference.label.padStart(10)];
for (const c of candidates) head.push(c.label.padStart(10), 'delta'.padStart(9));
head.push('A/A'.padStart(8), '  verdict');
console.log(head.join(''));
console.log('-'.repeat(head.join('').length));

for (const name of Object.keys(WORKLOADS)) {
  const samples = new Map(prepared.map((b) => [b.label, []]));
  for (let i = 0; i < PAIRS; i++) for (const b of prepared) samples.get(b.label).push(run(b.root, name).ns);
  for (let i = 0; i < PAIRS; i++) for (const b of [...prepared].reverse()) samples.get(b.label).push(run(b.root, name).ns);
  const aa = [];
  for (let i = 0; i < PAIRS; i++) { aa.push(run(reference.root, name).ns, run(reference.root, name).ns); }
  const maa = median(aa);
  const aaSpread = ((Math.max(...aa) - Math.min(...aa)) / maa) * 100;
  const mref = median(samples.get(reference.label));
  const cells = [name.padEnd(17), mref.toFixed(1).padStart(10)];
  const deltas = [];
  for (const c of candidates) {
    const mc = median(samples.get(c.label));
    const d = (mc / mref - 1) * 100;
    deltas.push(d);
    cells.push(mc.toFixed(1).padStart(10), `${(d >= 0 ? '+' : '') + d.toFixed(1)}%`.padStart(9));
  }
  const verdict = aaSpread > AA_THRESHOLD ? 'NOT RESOLVABLE'
    : deltas.every((d) => Math.abs(d) < aaSpread) ? 'within A/A'
    : deltas.map((d) => (d < 0 ? 'faster' : 'slower')).join('/');
  cells.push(`${aaSpread.toFixed(1)}%`.padStart(8), '  ' + verdict);
  console.log(cells.join(''));
}
for (const b of prepared) rmSync(b.root, { recursive: true, force: true });
