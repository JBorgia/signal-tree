// COMPANION to current-characterization.mjs. Records what SURVIVES a refusal.
//
// The four failing controls there stop at `settled(c.reject(p))`. When that
// assertion throws, every later value assertion is skipped — so that report
// establishes only "the operation refuses instead of reaching the old
// incorrect-value assertion". It does NOT establish that state, pending
// ownership or publication were preserved.
//
// This file measures those facts DIRECTLY, and deliberately does not assert
// them as a pass/fail oracle: weakening the successful-settlement expectation
// is what would hide the very gap the other file exists to show. Refusal safety
// is a separate dimension, recorded separately.
import { writeFileSync } from 'node:fs';
import { create, provenanceFor } from './current.mjs';

const set = (path, value) => ({ kind: 'set', path: [path], value });
const val = (snap, p) => snap.values.find((e) => e.path.join('.') === p)?.value;

const record = async (id, run) => {
  const c = await create({ profile: 'live' });
  // Counts EVERY coherent publication in the run, not only post-refusal ones.
  // Reported raw rather than asserted: isolating publication to the refusal
  // needs a marker the adapter does not expose.
  const observations = [];
  const off = c.observe(() => observations.push(1));
  let row;
  try {
    row = { id, ...run(c, observations), observationsDuringWholeRun: observations.length };
  } catch (error) {
    row = { id, error: String(error?.message ?? error).slice(0, 200) };
  } finally {
    off?.();
    c.destroy();
  }
  return row;
};

const r8 = (second) => (c, seen) => {
  const a = c.begin([set('x', 1), set('y', 1)]); c.flush();
  const b = c.begin([set('y', 2), set('z', 2)]); c.flush();
  const before = { x: val(c.read(), 'x'), y: val(c.read(), 'y'), z: val(c.read(), 'z') };
  // PUBLICATION ISOLATION is measurable here because everything earlier is
  // already flushed: take the observation boundary, reject, flush, and count
  // what arrived. Anything delivered is attributable to the refusal.
  const boundary = seen.length;
  const first = c.reject(a);
  c.flush();
  const publishedByRefusal = seen.length - boundary;
  const after = { x: val(c.read(), 'x'), y: val(c.read(), 'y'), z: val(c.read(), 'z') };
  return {
    firstStatus: first.status,
    stateUnchangedByRefusal: JSON.stringify(before) === JSON.stringify(after),
    before, after,
    refusedHandleKeepsAuthority: c.state(a).authority,
    otherHandleKeepsAuthority: c.state(b).authority,
    publishedByRefusal,
    publicationVerified: true,
    secondSettles: c[second](b).status,
  };
};

const sameTick = (context) => (c) => {
  const p = c.begin([set('x', 1)]); c.flush();
  c.write([set('x', 2)], { context });           // deliberately NOT flushed
  const before = { x: val(c.read(), 'x') };
  const first = c.reject(p);
  const after = { x: val(c.read(), 'x') };
  return {
    firstStatus: first.status,
    laterWritePreserved: after.x === 2,
    stateUnchangedByRefusal: JSON.stringify(before) === JSON.stringify(after),
    before, after,
    refusedHandleKeepsAuthority: c.state(p).authority,
    // NOT measured. The earlier write is deliberately unflushed, so a flush
    // after the refusal delivers that write AND anything the refusal did, with
    // nothing to tell them apart. Distinguishing them needs a matched control
    // that runs the identical scenario WITHOUT the rejection. Until that runs,
    // publication here is explicitly unverified rather than assumed clean.
    publishedByRefusal: null,
    publicationVerified: false,
  };
};

const rows = [];
rows.push(await record('R8-01-reject-accept', r8('accept')));
rows.push(await record('R8-01-reject-reject', r8('reject')));
rows.push(await record('same-tick-local-flush-false', sameTick('local')));
rows.push(await record('same-tick-external-flush-false', sameTick('external')));

// REQUIRED, not merely recorded. Asserting these here does NOT weaken the
// successful-settlement oracle in current-characterization.mjs: that file still
// demands settlement and still fails. The two results are meant to coexist —
//
//     successful settlement required  -> FAIL
//     refusal preserves state/authority -> PASS
//
// — and a candidate that achieved the first by abandoning the second would be
// caught here rather than celebrated there.
const violations = [];
for (const r of rows) {
  if (r.error) { violations.push(`${r.id}: execution error — ${r.error}`); continue; }
  if (r.firstStatus !== 'refused')
    violations.push(`${r.id}: expected a refusal, got ${r.firstStatus}`);
  if (r.stateUnchangedByRefusal !== true)
    violations.push(`${r.id}: refusal changed visible state`);
  if (r.refusedHandleKeepsAuthority !== true)
    violations.push(`${r.id}: refused handle lost pending authority`);
  if ('otherHandleKeepsAuthority' in r && r.otherHandleKeepsAuthority !== true)
    violations.push(`${r.id}: the OTHER handle lost authority`);
  if ('laterWritePreserved' in r && r.laterWritePreserved !== true)
    violations.push(`${r.id}: the later write was not preserved`);
  if (r.publicationVerified === true && r.publishedByRefusal !== 0)
    violations.push(`${r.id}: refusal published ${r.publishedByRefusal} change(s)`);
}
const unverified = rows.filter((r) => r.publicationVerified === false).map((r) => r.id);

const report = {
  provenance: provenanceFor(import.meta.url),
  kind: 'refusal-safety-characterization',
  requires: 'refusal preserves state, pending authority and (where measurable) publication',
  violations,
  publicationUnverified: unverified,
  rows,
};
console.log(JSON.stringify({ violations, publicationUnverified: unverified }, null, 2));
const out = process.argv[2];
if (out) writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
process.exitCode = violations.length ? 1 : 0;
