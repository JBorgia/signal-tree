#!/usr/bin/env node
/**
 * Permanent control for the bare-module SUBJECT IDENTITY scheme.
 *
 * The ownership ledger addresses bare-reachable modules by a key derived from
 * their source path. That derivation used to be `basename(path)`, which
 * collapsed two distinct subjects into one and censused the tool's own probe
 * entry as a phantom module. Both are fixed — this file is what keeps them
 * fixed.
 *
 *     THE EVIDENCE INFRASTRUCTURE MUST DEFEND THE IDENTITY SCHEME THAT ITS
 *     OWNERSHIP CLAIMS DEPEND ON.
 *
 * ⚠️ IT IMPORTS THE REAL FUNCTIONS from bare-module-list.mjs. A control that
 * re-implements the scheme proves only that the copy agrees with itself.
 */
import { normalizeBareSubject, isProbeEntry } from './bare-module-list.mjs';

const PLANTED = {
  colliding: [
    'dist/packages/kernel/dist/lib/constants.js',
    'dist/packages/kernel/dist/enhancers/serialization/constants.js',
  ],
  collidingIndex: [
    'dist/packages/kernel/dist/enhancers/index.js',
    'dist/packages/kernel/dist/lib/markers/index.js',
  ],
  internalUtility:
    'dist/packages/kernel/dist/lib/internals/utilities/deep-equal.js',
  probe: '../../../../private/var/folders/rq/xxxx/T/bml-abc123/b.js',
};

let failures = 0;
const check = (name, ok, detail) => {
  console.log(`  ${ok ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
};

// 1. two sources sharing a basename must remain two subjects
for (const [label, pair] of [
  ['constants.js', PLANTED.colliding],
  ['index.js', PLANTED.collidingIndex],
]) {
  const [a, b] = pair.map(normalizeBareSubject);
  check(
    `${label}: colliding basenames stay two subjects`,
    a !== b,
    `${a} vs ${b}`
  );
}

// 2. the killing mutation — the scheme this replaced
const basenameScheme = (p) => p.split('/').pop();
for (const [label, pair] of [
  ['constants.js', PLANTED.colliding],
  ['index.js', PLANTED.collidingIndex],
]) {
  const [a, b] = pair.map(basenameScheme);
  check(
    `${label}: basename collapse IS detectable (mutation kills)`,
    a === b,
    `both would be "${a}" — this is what the control forbids`
  );
}

// 3. kernel identity retained, dist prefix stripped, no absolute path
const internalUtility = normalizeBareSubject(PLANTED.internalUtility);
check(
  'kernel utility identity retained',
  internalUtility === 'core/lib/internals/utilities/deep-equal.ts',
  internalUtility
);
check(
  'dist prefix stripped',
  !internalUtility.includes('dist/'),
  internalUtility
);
const core = normalizeBareSubject(PLANTED.colliding[0]);
check('core package identity retained', core.startsWith('core/'), core);
check(
  'no absolute filesystem path',
  !core.startsWith('/') && !core.includes('/private/'),
  core
);

// 4. the synthetic probe entry is never a subject
check(
  'probe entry excluded',
  isProbeEntry(PLANTED.probe) === true,
  PLANTED.probe
);
check(
  'a real module is NOT treated as the probe',
  isProbeEntry(PLANTED.internalUtility) === false,
  PLANTED.internalUtility
);

if (failures) {
  console.error(`\n❌ bare-module identity control: ${failures} failure(s).`);
  process.exit(1);
}
console.log(
  '\n✅ bare-module identity control: subject keys are path-qualified, collision-safe, probe-free.'
);
