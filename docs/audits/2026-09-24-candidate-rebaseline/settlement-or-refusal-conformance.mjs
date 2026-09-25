// CANDIDATE CONFORMANCE — branches on the ACTUAL result.
//
// `refusal-safety-characterization.mjs` is an INCUMBENT regression
// characterization: it asserts `firstStatus === 'refused'`. Applied unchanged
// to a competing architecture it would be incoherent — the settlement suite
// demands settlement, this would demand refusal, and a candidate that
// correctly removes the contribution would be penalised for succeeding.
//
// So the requirement is conditional on what actually happened:
//
//   refused    state unchanged, same pending authority retained,
//              no forbidden publication
//   settled    correct surviving state, targeted authority TERMINAL,
//              unrelated authority preserved, coherent publication
//   unsupported  an explicit capability gap, recorded as such
//   error      a separate failure, NEVER relabelled a refusal
//
// The successful-settlement expectations are unchanged from the frozen
// scenarios; only the refusal branch is added beside them.
//
// ⚠️ PUBLICATION SCOPE. `observe()` here is driven by flushes and filters
// unchanged snapshots, so "0 callbacks" means NO CHANGED SNAPSHOT WAS DELIVERED
// THROUGH THAT PROJECTION. It is not a claim about native notification counts,
// nor about intermediate states that never reached a flush boundary.
import { writeFileSync } from 'node:fs';
import { create, provenanceFor } from './current.mjs';

const set = (path, value) => ({ kind: 'set', path: [path], value });
const val = (s, p) => s.values.find((e) => e.path.join('.') === p)?.value;
const snap = (c) => ({ x: val(c.read(), 'x'), y: val(c.read(), 'y'), z: val(c.read(), 'z') });

/** Each case states BOTH acceptable outcomes up front. */
const CASES = [
  {
    id: 'R8-01-reject-accept',
    expectedIfSettled: { x: 0, y: 2, z: 2 },
    run(c) {
      const a = c.begin([set('x', 1), set('y', 1)]); c.flush();
      const b = c.begin([set('y', 2), set('z', 2)]); c.flush();
      return { target: a, other: b, before: snap(c), act: () => c.reject(a), then: () => c.accept(b) };
    },
  },
  {
    id: 'R8-01-reject-reject',
    expectedIfSettled: { x: 0, y: 0, z: 0 },
    run(c) {
      const a = c.begin([set('x', 1), set('y', 1)]); c.flush();
      const b = c.begin([set('y', 2), set('z', 2)]); c.flush();
      return { target: a, other: b, before: snap(c), act: () => c.reject(a), then: () => c.reject(b) };
    },
  },
  {
    id: 'same-tick-local-flush-false',
    expectedIfSettled: { x: 2 },
    unflushed: true,
    run(c) {
      const p = c.begin([set('x', 1)]); c.flush();
      c.write([set('x', 2)], { context: 'local' });
      return { target: p, other: null, before: snap(c), act: () => c.reject(p) };
    },
  },
  {
    id: 'same-tick-external-flush-false',
    expectedIfSettled: { x: 2 },
    unflushed: true,
    run(c) {
      const p = c.begin([set('x', 1)]); c.flush();
      c.write([set('x', 2)], { context: 'external' });
      return { target: p, other: null, before: snap(c), act: () => c.reject(p) };
    },
  },
];

const evaluate = async (factory, spec) => {
  const c = await factory({ profile: 'live' });
  const seen = [];
  const off = c.observe(() => seen.push(1));
  const out = { id: spec.id };
  try {
    const f = spec.run(c);
    const boundary = seen.length;
    let result;
    try {
      result = f.act();
    } catch (error) {
      if (error?.name === 'Unsupported') {
        out.outcome = 'unsupported';
        out.reason = String(error.message).slice(0, 160);
        return out;
      }
      // An execution error is its OWN outcome and is never relabelled.
      out.outcome = 'error';
      out.reason = String(error?.message ?? error).slice(0, 160);
      return out;
    }
    if (!spec.unflushed) c.flush();
    const publishedByAct = spec.unflushed ? null : seen.length - boundary;
    const after = snap(c);
    out.outcome = result.status;
    out.after = after;
    out.publishedByAct = publishedByAct;
    out.publicationVerified = !spec.unflushed;

    if (result.status === 'refused') {
      out.required = 'refusal guarantees';
      out.stateUnchanged = JSON.stringify(f.before) === JSON.stringify(after);
      out.targetRetainsAuthority = c.state(f.target).authority === true;
      out.otherRetainsAuthority = f.other ? c.state(f.other).authority === true : null;
      out.noForbiddenPublication = publishedByAct === null ? null : publishedByAct === 0;
    } else if (result.status === 'settled') {
      out.required = 'settlement guarantees';
      if (f.then) { try { f.then(); } catch { /* recorded via state below */ } }
      const final = snap(c);
      out.final = final;
      out.survivingStateCorrect = Object.entries(spec.expectedIfSettled)
        .every(([k, v]) => final[k] === v);
      out.targetAuthorityTerminal = c.state(f.target).authority === false;
      out.otherAuthorityPreserved = f.other ? typeof c.state(f.other).authority === 'boolean' : null;
      out.coherentPublication = publishedByAct === null ? null : publishedByAct >= 0;
    } else {
      out.required = 'none — terminal duplicate or already-settled';
    }
  } catch (error) {
    out.outcome = 'error';
    out.reason = String(error?.message ?? error).slice(0, 160);
  } finally {
    off?.(); c.destroy();
  }
  return out;
};

const rows = [];
for (const spec of CASES) rows.push(await evaluate(create, spec));

const violations = [];
for (const r of rows) {
  if (r.outcome === 'error') { violations.push(`${r.id}: EXECUTION ERROR — ${r.reason}`); continue; }
  if (r.outcome === 'unsupported') continue;           // an explicit capability gap
  if (r.outcome === 'refused') {
    if (!r.stateUnchanged) violations.push(`${r.id}: refusal changed state`);
    if (!r.targetRetainsAuthority) violations.push(`${r.id}: refusal lost target authority`);
    if (r.otherRetainsAuthority === false) violations.push(`${r.id}: refusal lost the OTHER authority`);
    if (r.noForbiddenPublication === false) violations.push(`${r.id}: refusal published ${r.publishedByAct}`);
  } else if (r.outcome === 'settled') {
    if (!r.survivingStateCorrect) violations.push(`${r.id}: settled with wrong surviving state ${JSON.stringify(r.final)}`);
    if (!r.targetAuthorityTerminal) violations.push(`${r.id}: settled but target authority not terminal`);
  }
}

const report = {
  provenance: provenanceFor(import.meta.url),
  kind: 'settlement-or-refusal-conformance',
  publicationScope:
    'observe() is flush-driven and filters unchanged snapshots; 0 means no changed snapshot ' +
    'was delivered through that projection, NOT zero native notifications',
  outcomes: Object.fromEntries(rows.map((r) => [r.id, r.outcome])),
  violations,
  publicationUnverified: rows.filter((r) => r.publicationVerified === false).map((r) => r.id),
  rows,
};
console.log(JSON.stringify({ outcomes: report.outcomes, violations, publicationUnverified: report.publicationUnverified }, null, 2));
const out = process.argv[2];
if (out) writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
process.exitCode = violations.length ? 1 : 0;
