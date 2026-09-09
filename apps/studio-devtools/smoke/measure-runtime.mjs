/**
 * S1 disabled runtime overhead (spec §8.5 point 7).
 *
 * ⚠️ READ S1-COST-MEASUREMENTS.md §2 BEFORE TRUSTING A NUMBER FROM THIS. The
 * noise floor of this harness is far above the 1% threshold it was meant to
 * check — separate processes, JIT variance, an unquiet machine. It can show
 * "no detectable regression"; it cannot assert a 1% bound. The structural
 * guarantee (studio-unused-cost.spec.ts + zero bundle presence) is the real one.
 */
import { build } from 'esbuild';
import { writeFileSync, mkdtempSync, appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const WORKLOADS = {
  'scalar writes': `
    const t = signalTree({ a: 0, b: { c: 0 } });
    globalThis.run = (n) => { for (let i = 0; i < n; i++) t.$.a(i); return t.$.a(); };`,
  'transactional writes': `
    const t = signalTree({ a: 0, b: { c: 0 } }, { enhancers: [transactions()] });
    globalThis.run = (n) => {
      for (let i = 0; i < n; i++) t.transaction(() => { t.$.a(i); t.$.b.c(i); }).confirm();
      return t.$.a();
    };`,
};
const MATRIX = {
  'scalar writes': [[1_000, 25], [10_000, 25], [100_000, 15]],
  'transactional writes': [[1_000, 25], [10_000, 15]],
};

async function load(root, source) {
  const dir = mkdtempSync(join(tmpdir(), 'stbench-'));
  const entry = join(dir, 'e.mjs');
  writeFileSync(entry, `import { signalTree, transactions } from '@signal-tree/kernel';\n${source}`);
  const out = join(dir, 'b.mjs');
  await build({
    entryPoints: [entry], bundle: true, format: 'esm', outfile: out,
    logLevel: 'silent', platform: 'node',
    alias: { '@signal-tree/kernel': `${root}/packages/kernel/src/index.ts` },
  });
  await import(out);
  return globalThis.run;
}

const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s[s.length >> 1]; };
const spread = (xs) => `${Math.min(...xs).toFixed(1)}-${Math.max(...xs).toFixed(1)}`;

async function bench(root, source, n, reps) {
  const run = await load(root, source);
  for (let i = 0; i < 5; i++) run(n);
  const times = [];
  for (let i = 0; i < reps; i++) {
    const t0 = process.hrtime.bigint();
    run(n);
    times.push(Number(process.hrtime.bigint() - t0) / 1e6);
  }
  return times;
}

const BASE = process.env['BASE_ROOT'] ?? '/tmp/st-base';
const OUT = '/tmp/st-bench-results.md';
const say = (l) => { console.log(l); appendFileSync(OUT, l + '\n'); };

say('| workload | writes | reps | pre-S1 median | S1-unused median | delta |');
say('|---|---|---|---|---|---|');
for (const [name, source] of Object.entries(WORKLOADS)) {
  for (const [n, reps] of MATRIX[name]) {
    const bt = await bench(BASE, source, n, reps);
    const ht = await bench(process.cwd(), source, n, reps);
    const b = median(bt), h = median(ht);
    say(`| ${name} | ${n.toLocaleString()} | ${reps} | ${b.toFixed(2)} ms (${spread(bt)}) | ${h.toFixed(2)} ms (${spread(ht)}) | ${((h - b) / b * 100).toFixed(2)}% |`);
  }
}
say('');
say('Deltas within run-to-run spread are noise, not regression.');
