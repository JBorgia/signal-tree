#!/usr/bin/env node
/**
 * SELF-TEST FOR THE ONLY PASS/FAIL GATE IN THE RETAINED-HEAP HARNESSES.
 *
 * `measureRetained().collectable` was vacuous: it watched whatever `build()`
 * returned, and every arm returns a fresh wrapper (`{ t }`, `{ t, nodes }`)
 * that nothing else references. It answered `true` unconditionally — an audit
 * found all 20 cells of the realization matrix reporting `collectable: true`
 * while arms retained ~100 MB.
 *
 * A gate that cannot fail is worse than no gate, because it is read as
 * evidence. This asserts that it can now both pass AND fail.
 *
 *   node --expose-gc tools/lib/heap-quiescence.selftest.mjs
 */
import { measureRetained, requireExposeGc } from './heap-quiescence.mjs';

requireExposeGc('heap-quiescence selftest');

let failures = 0;
const check = (name, actual, expected) => {
  const ok = actual === expected;
  if (!ok) failures += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name} (expected ${expected}, got ${actual})`);
};

// A wrapper whose contents ARE released.
const clean = await measureRetained(() => ({ t: { payload: new Array(50000).fill(0) } }), {
  label: 'selftest/clean',
});
check('released contents report collectable', clean.collectable, true);

// A wrapper whose contents are pinned by a module-level retainer. The OLD
// implementation reported `true` here, which is the defect this file exists for.
const leaked = [];
const leaky = await measureRetained(
  () => {
    const t = { payload: new Array(50000).fill(0) };
    leaked.push(t);
    return { t };
  },
  { label: 'selftest/leaky' }
);
check('retained contents report NOT collectable', leaky.collectable, false);

// A build that returns its subject directly rather than a wrapper.
const bare = [];
const bareLeak = await measureRetained(
  () => {
    const t = { payload: new Array(50000).fill(0) };
    bare.push(t);
    return t;
  },
  { label: 'selftest/bare' }
);
check('unwrapped retained subject reports NOT collectable', bareLeak.collectable, false);

// THE CASE THE INFERRED SENTINELS CANNOT SEE. The array dies; one node inside
// it is retained by an internal registry. Shallow watching reports `true`.
const registry = [];
const shallow = await measureRetained(
  () => {
    const nodes = [];
    for (let i = 0; i < 5; i++) nodes.push({ id: i, payload: new Array(20000).fill(0) });
    registry.push(nodes[2]);
    return { t: { rows: 5 }, nodes };
  },
  { label: 'selftest/nested-shallow' }
);
check(
  'INFERRED sentinels miss a leaked nested node (known limit)',
  shallow.collectable,
  true
);

const registry2 = [];
const explicit = await measureRetained(
  () => {
    const nodes = [];
    for (let i = 0; i < 5; i++) nodes.push({ id: i, payload: new Array(20000).fill(0) });
    registry2.push(nodes[2]);
    return { t: { rows: 5 }, nodes };
  },
  {
    label: 'selftest/nested-explicit',
    // A deterministic sample: first, middle, last.
    sentinels: ({ nodes }) => [nodes[0], nodes[nodes.length >> 1], nodes[nodes.length - 1]],
  }
);
check(
  'EXPLICIT sentinels catch a leaked nested node',
  explicit.collectable,
  false
);

const clean2 = await measureRetained(
  () => {
    const nodes = [];
    for (let i = 0; i < 5; i++) nodes.push({ id: i, payload: new Array(20000).fill(0) });
    return { t: { rows: 5 }, nodes };
  },
  {
    label: 'selftest/nested-clean',
    sentinels: ({ nodes }) => [nodes[0], nodes[nodes.length >> 1], nodes[nodes.length - 1]],
  }
);
check('EXPLICIT sentinels pass when nothing leaks', clean2.collectable, true);

console.log(
  leaked.length + bare.length + registry.length + registry2.length > 0 ? '' : 'retainers empty'
);
if (failures > 0) {
  console.error(`\n${failures} gate self-test(s) failed — collectable is not trustworthy.`);
  process.exit(1);
}
console.log('\ncollectable gate is live: it passes when released and fails when retained.');
