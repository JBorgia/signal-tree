// CHECKER SELF-TEST — the conformance checker must reject known-bad adapters.
//
// Saved JSON is evidence of a past run; it enforces nothing. This file is the
// enforcement: four EXECUTABLE adapters, three of them deliberately broken, and
// a requirement that the checker's verdict on each is what it should be. Change
// the checker in a way that stops catching one of these and this goes red.
//
// It imports ONLY the pure core — never the incumbent adapter. A checker that
// judges implementations must not depend on one of the implementations being
// judged, and the previous single-file version could not run from a clean
// checkout at all because it statically imported the revision-pinned adapter
// out of a gitignored scratch directory.
//
// These adapters establish SPECIFIC DETECTION CAPABILITIES. Passing them means
// the checker catches these four shapes; it does not mean the checker is
// complete.
//
// Each broken adapter reproduces a hole the checker actually had:
//
//   midstep     destroys P2's y=2 while rejecting P1 and repairs it while
//               accepting P2 — the ending looks right
//   already     answers `already-settled` to every first rejection, doing
//               nothing, on a freshly opened handle
//   torn2       settles correctly but publishes {99,99,99} DURING the second
//               settlement before restoring the right final values
//
// The control settles correctly and must PASS, so the suite cannot be satisfied
// by a checker that simply rejects everything.
import { runConformance } from './candidate-conformance-core.mjs';

const base = (mode) => async () => {
  let values = { x: 0, y: 0, z: 0 };
  let n = 0;
  let cb = () => {};
  const pending = new Set();
  const read = () => ({ values: Object.entries(values).map(([k, value]) => ({ path: [k], value })) });
  const publish = () => cb(read());
  const tornSecond = () => { if (mode === 'torn2') { values = { x: 99, y: 99, z: 99 }; publish(); } };
  return {
    read,
    begin(ops) { for (const o of ops) values[o.path[0]] = o.value; pending.add(++n); return n; },
    write(ops) { for (const o of ops) values[o.path[0]] = o.value; },
    state(h) { return { authority: mode === 'midstep' ? false : pending.has(h) }; },
    observe(f) { cb = f; return () => {}; },
    flush() {}, destroy() {},
    reject(h) {
      if (mode === 'already') return { status: 'already-settled' };
      if (n === 2) {
        if (h === 1) values = mode === 'midstep' ? { x: 0, y: 0, z: 2 } : { x: 0, y: 2, z: 2 };
        else { tornSecond(); values = { x: 0, y: 0, z: 0 }; }
        publish();
      }
      pending.delete(h);
      return { status: 'settled' };
    },
    accept(h) { tornSecond(); values = { x: 0, y: 2, z: 2 }; pending.delete(h); publish(); return { status: 'settled' }; },
  };
};

const EXPECT = [
  { mode: 'control', mustFail: false, why: 'a correctly settling adapter must PASS' },
  { mode: 'midstep', mustFail: true, why: 'corruption between settlement steps' },
  { mode: 'already', mustFail: true, why: 'already-settled on a freshly opened handle' },
  { mode: 'torn2', mustFail: true, why: 'torn publication during the SECOND settlement' },
];

const problems = [];
const summary = [];
for (const { mode, mustFail, why } of EXPECT) {
  const { violations } = await runConformance(base(mode));
  const failed = violations.length > 0;
  summary.push({ mode, violations: violations.length, failed, expectedToFail: mustFail });
  if (failed !== mustFail) {
    problems.push(
      mustFail
        ? `checker did NOT catch ${mode}: ${why} — ${violations.length} violations`
        : `checker wrongly rejected the ${mode}: ${violations.map((v) => v.slice(0, 80)).join(' | ')}`
    );
  }
}

console.log(JSON.stringify({ summary, problems }, null, 2));
if (problems.length) {
  console.error('\nconformance-selftest: the checker no longer does its job.');
  for (const p of problems) console.error('  - ' + p);
}
process.exitCode = problems.length ? 1 : 0;
