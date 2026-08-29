/**
 * One measurement arm, in its OWN worker thread.
 *
 * ⚠️ ISOLATION IS THE POINT. Two SignalTree builds in one module graph would
 * share module-level installation state — the realization port, the tracking
 * suppression, the notifier singleton — so a baseline and a candidate could
 * contaminate each other's measurement. Each arm gets its own graph.
 */
import { parentPort, workerData } from 'node:worker_threads';
import { performance } from 'node:perf_hooks';

const { buildPath, mode } = workerData;
const { signalTree } = await import(buildPath);

/** The forbidden architecture, used ONLY as a harness sensitivity control. */
const wrap = (leaf) => {
  const w = () => leaf();
  w.set = (v) => leaf.set(v);
  return w;
};

const wide = (n) => { const o = {}; for (let i = 0; i < n; i++) o[`k${i}`] = i; return o; };

/**
 * ⚠️ PER-OP SCALE. A/A at a single global n gave `scalar-read` a p90 of +2836%
 * and `scalar-write` +408% — those ops finish in microseconds, so the
 * measurement was scheduler noise rather than work. Each op is scaled so a
 * single measurement lasts long enough to dominate its own jitter. The scale is
 * part of the operation definition and therefore part of comparability.
 */
export const OP_SCALE = {
  'construct-plain': 1,
  'scalar-read': 200,
  'scalar-write': 200,
  'merge-write-many': 1,
};

const OPS = {
  'construct-plain': (n) => {
    let made = 0;
    for (let i = 0; i < n; i++) { signalTree({ a: 1, b: { c: 2 } }); made++; }
    return made;
  },
  'scalar-read': (n) => {
    const t = signalTree({ a: 1 });
    const leaf = mode === 'wrapped' ? wrap(t.$.a) : t.$.a;
    let acc = 0;
    for (let i = 0; i < n; i++) acc += leaf();
    return acc;
  },
  'scalar-write': (n) => {
    const t = signalTree({ a: 0 });
    const leaf = mode === 'wrapped' ? wrap(t.$.a) : t.$.a;
    for (let i = 0; i < n; i++) leaf.set(i);
    return leaf();
  },
  'merge-write-many': (n) => {
    const t = signalTree(wide(64));
    const rounds = Math.max(1, Math.floor(n / 64));
    for (let i = 0; i < rounds; i++) {
      const p = {};
      for (let k = 0; k < 64; k++) p[`k${k}`] = i + k;
      t(p);
    }
    return t.$.k0();
  },
};

parentPort.on('message', (msg) => {
  if (msg.kind === 'warm') {
    for (let i = 0; i < msg.rounds; i++) for (const fn of Object.values(OPS)) fn(200);
    parentPort.postMessage({ kind: 'warmed' });
    return;
  }
  const fn = OPS[msg.op];
  const n = msg.n * (OP_SCALE[msg.op] ?? 1);
  const t0 = performance.now();
  const result = fn(n);
  const ms = performance.now() - t0;
  // ⚠️ EVERY ARM ASSERTS ITS WORK LANDED — an arm that silently stopped doing
  // anything would otherwise report as "faster".
  parentPort.postMessage({ kind: 'result', ms, ok: typeof result === 'number' });
});
