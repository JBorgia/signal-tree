#!/usr/bin/env node
// Self-test for bridge.mjs, using DELIBERATELY BROKEN DOUBLES.
//
// Every check here locks a defect that was actually found by hand on
// 2026-09-24. A harness that cannot catch its own known defects is not
// evidence, and three of these shipped in the first three drafts of the bridge:
//   D1 class identity   -- honest refusals miscounted as execution errors
//   D2 seed mismatch    -- membership counts off by one, adds colliding
//   D3 translation gaps -- declared model gaps escaping as errors
// The rest lock the four honesty rules, which are the checks most likely to be
// "helpfully" relaxed later into something that looks more complete and is less
// trustworthy.
//
// Exit code is the verdict. Do not grep this output to decide pass/fail.
import { createBridge, useContractUnsupported } from './bridge.mjs';

class ContractUnsupported extends Error {}
useContractUnsupported(ContractUnsupported);

class ModelUnsupported extends Error {
  constructor(m) {
    super(m);
    this.name = 'Unsupported';
  }
}

const problems = [];
const check = (ok, label, detail) => {
  if (!ok) problems.push(detail ? `${label} -- ${detail}` : label);
};
/** Assert fn throws the CONTRACT's class, which is what the frozen runner counts. */
const refuses = (fn, label) => {
  try {
    fn();
    problems.push(`${label}: expected a refusal, got a value`);
  } catch (error) {
    check(
      error instanceof ContractUnsupported,
      label,
      `threw ${error?.constructor?.name}/${error?.name}, not the contract class`
    );
  }
};

/** Minimal PROTOCOL model whose behaviour each test overrides. */
const model = (over = {}) => {
  const seenSeeds = [];
  const base = {
    begin: () => 'id-1',
    accept: () => ({ status: 'settled' }),
    reject: () => ({ status: 'settled' }),
    write: () => ({ status: 'settled' }),
    authority: () => ({ status: 'settled' }),
    flush: () => undefined,
    destroy: () => undefined,
    read: () => ({ values: [], entities: [] }),
    canonical: () => ({ values: [], entities: [] }),
    state: () => ({ status: 'pending', authority: true, dispositions: ['pending'] }),
    observe: () => () => undefined,
    stats: () => ({ active: 0, retainedOperations: 0, history: 7 }),
  };
  const create = (options) => {
    seenSeeds.push(options?.seed);
    return { ...base, ...over };
  };
  return { create, seenSeeds };
};

// ---------------------------------------------------------------- D1 + D3
// A model that declares a capability gap must be reported `unsupported`, not
// `error`. This is the defect that made 36 confirmedCount refusals, 9 link
// refusals and 127 replay refusals all count as execution errors.
for (const [label, over] of [
  ['begin', { begin: () => { throw new ModelUnsupported('scalars only'); } }],
  ['accept', { accept: () => { throw new ModelUnsupported('nope'); } }],
  ['read', { read: () => { throw new ModelUnsupported('no reader'); } }],
  ['ordinary write', { write: () => { throw new ModelUnsupported('scalars only'); } }],
]) {
  const f = createBridge(model(over).create);
  refuses(() => {
    switch (label) {
      case 'begin':
        return f.candidate.beginContribution(() => f.write('x', 1));
      case 'accept':
        return f.candidate.settleAccept(f.candidate.beginContribution(() => f.write('x', 1)));
      case 'read':
        return f.candidate.readVisible();
      default:
        return f.write('x', 1); // outside a contribution -> ordinary write path
    }
  }, `D1/D3 model gap via ${label} is translated to the contract class`);
}

// A genuine bug must NOT be laundered into `unsupported`; it has to stay an error.
{
  const f = createBridge(model({ begin: () => { throw new TypeError('real bug'); } }).create);
  let seen;
  try {
    f.candidate.beginContribution(() => f.write('x', 1));
  } catch (error) {
    seen = error;
  }
  check(
    seen instanceof TypeError,
    'D3 a real bug is NOT laundered into unsupported',
    `got ${seen?.constructor?.name}`
  );
}

// ---------------------------------------------------------------------- D2
// The frozen fixtures start from {x,y,z:0} with an EMPTY entity map. Using
// PROTOCOL's default seed (one entity at key 'A') put every membership count
// off by one and made case adds collide with 'Business key occupied'.
{
  const m = model();
  createBridge(m.create);
  const seed = m.seenSeeds[0];
  check(Array.isArray(seed?.entities) && seed.entities.length === 0,
    'D2 bridge seeds an EMPTY entity map',
    `entities=${JSON.stringify(seed?.entities)}`);
  check(
    JSON.stringify((seed?.values ?? []).map((v) => [v.path.join('.'), v.value])) ===
      JSON.stringify([['x', 0], ['y', 0], ['z', 0]]),
    'D2 bridge seeds x/y/z = 0',
    JSON.stringify(seed?.values)
  );
}
// An explicit seed from the caller still wins.
{
  const m = model();
  const mine = { values: [{ path: ['q'], value: 9 }], entities: [] };
  createBridge(m.create, { seed: mine });
  check(m.seenSeeds[0] === mine, 'D2 an explicit caller seed is not overridden');
}

// ------------------------------------------------------------ honesty rules
// Rule 1: non-uniform per-operation dispositions are not flattened by precedence.
{
  const f = createBridge(
    model({ state: () => ({ status: 'pending', authority: true, dispositions: ['committed', 'superseded'] }) }).create
  );
  const h = f.candidate.beginContribution(() => f.write('x', 1));
  refuses(() => f.candidate.readSettlementState(h), 'rule 1 non-uniform dispositions are unsupported');
}
// ...but a uniform one is still reported, or the rule would be vacuous.
{
  const f = createBridge(
    model({ state: () => ({ status: 'pending', authority: true, dispositions: ['committed', 'committed'] }) }).create
  );
  const h = f.candidate.beginContribution(() => f.write('x', 1));
  check(f.candidate.readSettlementState(h).disposition === 'committed',
    'rule 1 is not vacuous: a uniform disposition IS reported');
}
// Rule 2: 'conflicted' is never synthesized.
{
  const f = createBridge(
    model({ state: () => ({ status: 'pending', authority: true, dispositions: ['conflicted'] }) }).create
  );
  const h = f.candidate.beginContribution(() => f.write('x', 1));
  refuses(() => f.candidate.readSettlementState(h), "rule 2 'conflicted' is unsupported");
}
// Rule 3: confirmedCount is unsupported even though stats().history exists.
{
  const f = createBridge(model().create);
  refuses(() => f.confirmedCount(), 'rule 3 confirmedCount refuses despite stats().history');
}
// Rule 4: links are unsupported.
{
  const f = createBridge(model().create);
  refuses(() => f.domain.linkName({}, () => undefined), 'rule 4 linkName is unsupported');
}
// Composition is absent, not stubbed.
{
  const f = createBridge(model().create);
  check(f.composition === undefined, 'composition is absent, not stubbed');
}
// A model Result of 'unsupported' must not be widened into a settlement.
{
  const f = createBridge(model({ accept: () => ({ status: 'unsupported', reason: 'x' }) }).create);
  const h = f.candidate.beginContribution(() => f.write('x', 1));
  refuses(() => f.candidate.settleAccept(h), "a model 'unsupported' Result is not widened");
}

console.log(
  JSON.stringify({ checks: 'bridge-selftest', problems }, null, 2)
);
if (problems.length) process.exit(1);
