// CANDIDATE CONFORMANCE CORE — pure. Judges an implementation; depends on NONE.
//
// Split out so the self-test can run from a clean checkout. The previous single
// file statically imported the incumbent adapter, so the committed self-test
// could not execute outside one gitignored scratch directory — the checker that
// judges implementations depended on one of the implementations being judged.
//
// `refusal-safety-characterization.mjs` is an INCUMBENT regression
// characterization: it asserts `firstStatus === 'refused'`. Applied unchanged
// to a competing architecture it would be incoherent — a candidate that
// correctly removes the contribution would be penalised for succeeding. So the
// requirement here is conditional on what actually happened:
//
//   refused        state unchanged, same pending authority retained,
//                  no forbidden publication
//   settled        correct state AFTER EACH STEP, targeted authority terminal,
//                  unrelated authority still pending, coherent publication
//   unsupported    an explicit capability gap, recorded and not counted against
//   error          its own failure, NEVER relabelled a refusal
//   anything else  a VIOLATION. A newly pending handle cannot be
//                  `already-settled`.
//
// ⚠️ AN EARLIER VERSION OF THIS FILE PASSED TWO DELIBERATELY BROKEN ADAPTERS.
// Each hole it had is now a named check:
//
//   1 it compared only the FINAL state, so an adapter that destroyed P2's y=2
//     when rejecting P1 and repaired it when accepting P2 scored clean. State is
//     now asserted IMMEDIATELY after the first settlement, before the second.
//   2 "other authority preserved" tested `typeof === 'boolean'` — which `false`
//     satisfies — and never reached the verdict. It now requires the OTHER
//     handle to be STILL PENDING right after the first settles, and checks its
//     own terminality separately after its own settlement.
//   3 "coherent publication" tested `count >= 0`, always true, and never
//     reached the verdict. Delivered SNAPSHOTS are now recorded and compared
//     against the permitted coherent states.
//   4 `already-settled` on a freshly opened handle fell into an else-branch
//     that required nothing, and an exception from the SECOND settlement was
//     swallowed. Both now fail.
//
// ⚠️ PUBLICATION SCOPE, unchanged: `observe()` is flush-driven and filters
// unchanged snapshots. A clean result means no DISALLOWED CHANGED SNAPSHOT
// reached that projection — not zero native notifications, and nothing about
// intermediate states that never hit a flush boundary.

const set = (path, value) => ({ kind: 'set', path: [path], value });
const val = (s, p) => s.values.find((e) => e.path.join('.') === p)?.value;
const snap = (c) => ({ x: val(c.read(), 'x'), y: val(c.read(), 'y'), z: val(c.read(), 'z') });
const eq = (a, b) => Object.entries(b).every(([k, v]) => a[k] === v);

const CASES = [
  {
    id: 'R8-01-reject-accept',
    // Rejecting P1 must remove ONLY P1's contribution. P2 is untouched and
    // still pending, so y stays 2.
    expectedAfterFirst: { x: 0, y: 2, z: 2 },
    expectedFinal: { x: 0, y: 2, z: 2 },
    open(c) {
      const a = c.begin([set('x', 1), set('y', 1)]); c.flush();
      const b = c.begin([set('y', 2), set('z', 2)]); c.flush();
      return { target: a, other: b, first: () => c.reject(a), second: () => c.accept(b) };
    },
  },
  {
    id: 'R8-01-reject-reject',
    expectedAfterFirst: { x: 0, y: 2, z: 2 },
    expectedFinal: { x: 0, y: 0, z: 0 },
    open(c) {
      const a = c.begin([set('x', 1), set('y', 1)]); c.flush();
      const b = c.begin([set('y', 2), set('z', 2)]); c.flush();
      return { target: a, other: b, first: () => c.reject(a), second: () => c.reject(b) };
    },
  },
  {
    id: 'same-tick-local-flush-false',
    expectedAfterFirst: { x: 2 },
    expectedFinal: { x: 2 },
    unflushed: true,
    open(c) {
      const p = c.begin([set('x', 1)]); c.flush();
      c.write([set('x', 2)], { context: 'local' });
      return { target: p, other: null, first: () => c.reject(p), second: null };
    },
  },
  {
    id: 'same-tick-external-flush-false',
    expectedAfterFirst: { x: 2 },
    expectedFinal: { x: 2 },
    unflushed: true,
    open(c) {
      const p = c.begin([set('x', 1)]); c.flush();
      c.write([set('x', 2)], { context: 'external' });
      return { target: p, other: null, first: () => c.reject(p), second: null };
    },
  },
];

const authorityOf = (c, h) => {
  try { return c.state(h).authority === true; } catch { return null; }
};

const evaluate = async (factory, spec) => {
  const c = await factory({ profile: 'live' });
  const delivered = [];
  const off = c.observe((s) => delivered.push(s ? { x: val(s, 'x'), y: val(s, 'y'), z: val(s, 'z') } : snap(c)));
  const out = { id: spec.id, violations: [] };
  const bad = (m) => out.violations.push(`${spec.id}: ${m}`);
  try {
    const f = spec.open(c);
    const before = snap(c);
    out.before = before;
    const mark = delivered.length;

    let result;
    try { result = f.first(); }
    catch (error) {
      if (error?.name === 'Unsupported') { out.outcome = 'unsupported'; out.reason = String(error.message).slice(0, 160); return out; }
      out.outcome = 'error'; out.reason = String(error?.message ?? error).slice(0, 160);
      bad(`EXECUTION ERROR on the first settlement — ${out.reason}`);
      return out;
    }
    if (!spec.unflushed) c.flush();
    out.outcome = result?.status;
    const afterFirst = snap(c);
    out.afterFirst = afterFirst;
    out.deliveredByFirst = spec.unflushed ? null : delivered.slice(mark);
    out.publicationVerified = !spec.unflushed;

    if (out.outcome === 'unsupported') { out.reason = result?.reason; return out; }

    if (out.outcome === 'refused') {
      if (!eq(afterFirst, before)) bad(`refusal changed state ${JSON.stringify(afterFirst)}`);
      if (authorityOf(c, f.target) !== true) bad('refusal lost the target pending authority');
      if (f.other && authorityOf(c, f.other) !== true) bad('refusal lost the OTHER pending authority');
      if (out.deliveredByFirst && out.deliveredByFirst.length > 0)
        bad(`refusal published ${out.deliveredByFirst.length} changed snapshot(s)`);
      return out;
    }

    if (out.outcome !== 'settled') {
      // A freshly opened handle is not already settled, and no other terminal
      // status is legal for a first settlement.
      bad(`illegal first-settlement result '${out.outcome}' on a newly pending handle`);
      return out;
    }

    // ---- settled: every step is checked, not just the end ------------------
    if (!eq(afterFirst, spec.expectedAfterFirst))
      bad(`state after the FIRST settlement is ${JSON.stringify(afterFirst)}, expected ${JSON.stringify(spec.expectedAfterFirst)}`);
    if (authorityOf(c, f.target) !== false)
      bad('settled but the target authority is not terminal');
    if (f.other && authorityOf(c, f.other) !== true)
      bad('the OTHER handle is no longer pending after the first settlement');
    if (out.deliveredByFirst) {
      const permitted = [before, spec.expectedAfterFirst];
      const torn = out.deliveredByFirst.filter((d) => !permitted.some((p) => eq(d, p)));
      out.tornPublications = torn;
      if (torn.length) bad(`published ${torn.length} incoherent snapshot(s): ${JSON.stringify(torn.slice(0, 2))}`);
    }

    if (f.second) {
      // A SECOND PUBLICATION BOUNDARY. Checking snapshots only around the first
      // settlement left the second unguarded: an adapter that published
      // {x:99,y:99,z:99} during P2's settlement and then restored the correct
      // final values scored clean, because the ending looked right — the same
      // shape as the mid-sequence state hole, one step later.
      const mark2 = delivered.length;
      let secondResult;
      try { secondResult = f.second(); }
      catch (error) {
        out.secondOutcome = 'error';
        bad(`EXECUTION ERROR on the second settlement — ${String(error?.message ?? error).slice(0, 120)}`);
        return out;
      }
      if (!spec.unflushed) c.flush();
      out.secondOutcome = secondResult?.status;
      if (secondResult?.status !== 'settled')
        bad(`the second settlement returned '${secondResult?.status}', expected 'settled'`);
      if (authorityOf(c, f.other) !== false)
        bad('the OTHER handle is not terminal after its own settlement');
      if (!spec.unflushed) {
        out.deliveredBySecond = delivered.slice(mark2);
        const permitted2 = [spec.expectedAfterFirst, spec.expectedFinal];
        const torn2 = out.deliveredBySecond.filter((d) => !permitted2.some((q) => eq(d, q)));
        out.tornPublicationsSecond = torn2;
        if (torn2.length)
          bad(`the second settlement published ${torn2.length} incoherent snapshot(s): ${JSON.stringify(torn2.slice(0, 2))}`);
      }
    }

    const final = snap(c);
    out.final = final;
    if (!eq(final, spec.expectedFinal))
      bad(`final state is ${JSON.stringify(final)}, expected ${JSON.stringify(spec.expectedFinal)}`);
  } catch (error) {
    out.outcome = 'error';
    out.reason = String(error?.message ?? error).slice(0, 160);
    bad(`EXECUTION ERROR — ${out.reason}`);
  } finally {
    off?.(); c.destroy();
  }
  return out;
};

/** Drive the frozen cases against ANY adapter factory. */
export const runConformance = async (factory) => {
  const rows = [];
  for (const spec of CASES) rows.push(await evaluate(factory, spec));
  return { rows, violations: rows.flatMap((r) => r.violations) };
};

export { CASES };

export const PUBLICATION_SCOPE =
  'observe() is flush-driven and filters unchanged snapshots; a clean result means no ' +
  'DISALLOWED CHANGED SNAPSHOT was observed through that projection during the measured ' +
  'settlement boundary — not a claim that nothing incoherent was ever published internally';
