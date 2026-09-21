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

console.log(leaked.length + bare.length > 0 ? '' : 'retainers empty');
if (failures > 0) {
  console.error(`\n${failures} gate self-test(s) failed — collectable is not trustworthy.`);
  process.exit(1);
}
console.log('\ncollectable gate is live: it passes when released and fails when retained.');
