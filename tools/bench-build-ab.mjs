#!/usr/bin/env node
/**
 * PAIRED A/B BETWEEN TWO SIGNALTREE BUILDS — the harness that did not exist.
 *
 * ## Why this is committed
 *
 * The CPU numbers published for `SUBJECT-EPOCH-0` came from an ad-hoc script
 * that was never committed. An independent audit could not reproduce or falsify
 * them: the arm definitions were unrecoverable, so the claim was unfalsifiable
 * as written. That is a worse defect than a wrong number. Everything this file
 * measures is now attackable by anyone with the repository.
 *
 * It also encodes the two lessons this program paid for:
 *
 * 1. ONE WORKLOAD PER PROCESS. A multi-workload harness that rebuilds between
 *    arms produced a "+4.1% regression, ranges do not overlap" that was pure
 *    cross-run state — the code it blamed provably never executed in that arm.
 * 2. AN A/A CONTROL DECIDES RESOLVABILITY, NOT THE OPERATOR. A workload whose
 *    A/A spread exceeds the threshold is reported `NOT RESOLVABLE` and gets no
 *    number. It is not re-run until it looks clean.
 *
 * ## Arms
 *
 * `byId` is split, because the single name hid a sign change. Cold byId
 * realizes a subject; warm byId re-reads one already realized. A design that
 * moves work out of realization and into the read path makes the first faster
 * and the second slower, and a harness that only measures one of them will
 * report whichever answer it happened to pick.
 *
 *   node tools/bench-build-ab.mjs --a <distRootA> --b <distRootB> [--pairs 10]
 *
 * Each dist root must contain `kernel/` and `angular/` package directories.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync, cpSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (n, f) => { const i = process.argv.indexOf(n); return i === -1 ? f : process.argv[i + 1]; };
const PAIRS = Number(arg('--pairs', 10));
const A_ROOT = arg('--a', '') ? resolve(arg('--a', '')) : '';
const B_ROOT = arg('--b', '') ? resolve(arg('--b', '')) : '';
/**
 * `--roots ref=<path>,cand=<path>[,cand2=<path>]` compares several builds
 * against the FIRST, which is the reference. The decision this harness exists
 * for is three-way — strong pre-epoch carrier, cell-based epoch, token-only
 * epoch — and running it as three separate pairs would let the operator choose
 * which pairing to quote.
 */
const ROOTS = arg('--roots', '')
  ? arg('--roots', '')
      .split(',')
      .map((entry) => {
        const [label, path] = entry.split('=');
        if (!label || !path) throw new Error(`bad --roots entry: ${entry}`);
        return { label, path: resolve(path) };
      })
  : [];
const AA_THRESHOLD = Number(arg('--aa-threshold', 5));
const RUNTIME_DEPS = ['@angular', 'rxjs', 'zone.js', 'tslib'];

const WORKLOADS = {
  'updateOne': `
    t.$.rows.setAll(seed(10000));
    for (let i=0;i<20000;i++) t.$.rows.updateOne(i%10000,{v:i});
    OPS=200000; S(); for(let i=0;i<OPS;i++) t.$.rows.updateOne(i%10000,{v:i}); E();`,
  'byId-warm': `
    t.$.rows.setAll(seed(10000));
    for (let i=0;i<10000;i++) void t.$.rows.byId(i)?.();
    for (let i=0;i<20000;i++) void t.$.rows.byId(i%10000);
    OPS=200000; S(); for(let i=0;i<OPS;i++) void t.$.rows.byId(i%10000); E();`,
  'byId-cold': `
    OPS=0; let acc=0; S();
    for (let r=0;r<20;r++) {
      const fresh = m.signalTree({ rows: m.entityMap(cfg) });
      fresh.$.rows.setAll(seed(10000));
      for (let i=0;i<10000;i++) { void fresh.$.rows.byId(i)?.(); acc++; }
      fresh.destroy?.();
    }
    OPS=acc; E();`,
  'field-read-held': `
    t.$.rows.setAll(seed(10000));
    const held=[]; for(let i=0;i<10000;i++) held.push(t.$.rows.byId(i));
    for (let i=0;i<20000;i++) void held[i%10000].name();
    OPS=200000; S(); for(let i=0;i<OPS;i++) void held[i%10000].name(); E();`,
  'setAll-reused': `
    for (let i=0;i<5;i++) t.$.rows.setAll(seed(10000));
    OPS=25; S(); for(let i=0;i<OPS;i++) t.$.rows.setAll(seed(10000)); E();`,
  'scalar-set': `
    const t2 = m.signalTree({ a: 0 });
    for (let i=0;i<50000;i++) t2.$.a(i);
    OPS=500000; S(); for(let i=0;i<OPS;i++) t2.$.a(i); E();`,
};

const CELL = (body) => `
const m = await import('@signal-tree/angular');
const now = () => Number(process.hrtime.bigint()) / 1e6;
const seed = (n) => { const d=[]; for(let i=0;i<n;i++) d.push({id:i,name:'n'+i,v:i}); return d; };
const cfg = { selectId: (r) => r.id };
const t = m.signalTree({ rows: m.entityMap(cfg) });
let OPS=0, _s=0, _e=0;
const S = () => { _s = now(); };
const E = () => { _e = now(); };
${body}
console.log((((_e-_s)/OPS)*1e6).toFixed(2));
`;

function makeRoot(distRoot) {
  const root = mkdtempSync(join(tmpdir(), 'st-ab-'));
  mkdirSync(join(root, 'node_modules/@signal-tree'), { recursive: true });
  // COPIED, not symlinked: Node resolves a symlinked module's bare imports from
  // its realpath, so a symlinked @signal-tree/angular would resolve its own
  // kernel import back through the workspace and silently measure that build.
  for (const pkg of ['kernel', 'angular']) {
    cpSync(join(distRoot, pkg), join(root, `node_modules/@signal-tree/${pkg}`), { recursive: true });
  }
  // SYMLINKED for the mirror-image reason: copying a pnpm package detaches it
  // from the .pnpm store its internal imports resolve through.
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

const run = (root, name) => {
  const file = join(root, `w-${name}.mjs`);
  writeFileSync(file, CELL(WORKLOADS[name]));
  return Number(execFileSync(process.execPath, [file], { cwd: root, encoding: 'utf8' }).trim());
};

const median = (xs) => { const s=[...xs].sort((x,y)=>x-y); const m=s.length>>1; return s.length%2?s[m]:(s[m-1]+s[m])/2; };

const builds = ROOTS.length
  ? ROOTS
  : A_ROOT && B_ROOT
  ? [{ label: 'A', path: A_ROOT }, { label: 'B', path: B_ROOT }]
  : [];
if (builds.length < 2) {
  console.error('usage: --roots ref=<dist>,cand=<dist>[,cand2=<dist>]   (or --a <dist> --b <dist>)');
  process.exit(2);
}

const prepared = builds.map((b) => ({ ...b, root: makeRoot(b.path) }));
const [reference, ...candidates] = prepared;

console.log(`paired A/B — ${PAIRS} pairs per order, both orders, one workload per process`);
for (const b of prepared) console.log(`  ${b.label.padEnd(10)} ${b.path}`);
console.log(`\nreference = ${reference.label}; A/A rejection threshold ${AA_THRESHOLD}% of median`);
console.log('A workload whose A/A spread exceeds the threshold reports NOT RESOLVABLE');
console.log('and gets NO number. Do not re-run it until it looks clean.\n');

const head = ['workload'.padEnd(17), reference.label.padStart(10)];
for (const c of candidates) head.push(c.label.padStart(10), 'delta'.padStart(9));
head.push('A/A'.padStart(8), '  verdict');
console.log(head.join(''));
console.log('-'.repeat(head.join('').length));

for (const name of Object.keys(WORKLOADS)) {
  const samples = new Map(prepared.map((b) => [b.label, []]));
  // Interleave every build within each pass, then repeat in reverse order, so
  // no build systematically occupies a hotter or colder slot.
  for (let i = 0; i < PAIRS; i++) {
    for (const b of prepared) samples.get(b.label).push(run(b.root, name));
  }
  for (let i = 0; i < PAIRS; i++) {
    for (const b of [...prepared].reverse()) samples.get(b.label).push(run(b.root, name));
  }
  const aa = [];
  for (let i = 0; i < PAIRS; i++) { aa.push(run(reference.root, name), run(reference.root, name)); }
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
  const verdict = aaSpread > AA_THRESHOLD
    ? 'NOT RESOLVABLE'
    : deltas.every((d) => Math.abs(d) < aaSpread)
    ? 'within A/A'
    : deltas.map((d) => (d < 0 ? 'faster' : 'slower')).join('/');
  cells.push(`${aaSpread.toFixed(1)}%`.padStart(8), '  ' + verdict);
  console.log(cells.join(''));
}
for (const b of prepared) rmSync(b.root, { recursive: true, force: true });
