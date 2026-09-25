#!/usr/bin/env node
// Runs the UNCHANGED frozen SEMANTICS-2 cases against a transaction-options
// candidate, through the shared bridge. Edits nothing in the frozen harness and
// nothing in tools/experiments/.
//
// Two paths are available for the incumbent, which is what makes calibration
// possible:
//   --native            the real kernel through semantics-current-adapter
//   <model>.mjs         any PROTOCOL model through bridge.mjs
// Calibration compares those two ONLY on observations both can make. It
// measures translation fidelity. It does NOT make incumbent behaviour the
// oracle, and it does NOT define the comparison set for other candidates: the
// frozen contract supplies expected behaviour, so a row the incumbent cannot
// observe is still a valid candidate test when the bridge represents it
// honestly.
import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createBridge, useContractUnsupported } from './bridge.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../..');
const K = 'packages/kernel/src/enhancers/transactions';

const hash = (p) => {
  try {
    return createHash('sha256').update(readFileSync(p)).digest('hex').slice(0, 16);
  } catch {
    return 'missing';
  }
};

const [target, outPath, profileArg] = process.argv.slice(2);
if (!target || !outPath) {
  console.error('Usage: run-bridged.mjs <model.mjs|--native> <out.json> [profile]');
  process.exit(2);
}
const profile = profileArg ?? 'live';

// Compile the frozen cases and the native adapter once, from the WORKING TREE
// (HEAD). Candidate models stay out of this bundle and load natively.
const entry = `
import {runSupplemental,SUPPLEMENTAL_CASES} from './${K}/semantics-supplemental';
import {STRUCTURAL_CASES} from './${K}/semantics-structural';
import {AUTHORITY_CASES} from './${K}/semantics-authority';
import {makeCurrent,makeOccupiedConflict} from './${K}/semantics-current-adapter';
import {makeStructural} from './${K}/semantics-structural-adapter';
import {UnsupportedSemantic} from './packages/kernel/src/enhancers/transactions/semantics-contract';
export {runSupplemental,SUPPLEMENTAL_CASES,STRUCTURAL_CASES,AUTHORITY_CASES,
        makeCurrent,makeOccupiedConflict,makeStructural,UnsupportedSemantic};
`;
const bundled = await build({
  stdin: { contents: entry, resolveDir: root, sourcefile: 'bridged-entry.ts', loader: 'ts' },
  absWorkingDir: root,
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
  target: 'node24',
});
const S = await import(
  `data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`
);

useContractUnsupported(S.UnsupportedSemantic);

let factoryFor;
let modelPath = null;
if (target === '--native') {
  factoryFor = {
    scalar: S.makeCurrent,
    occupied: S.makeOccupiedConflict,
    structural: S.makeStructural,
  };
} else {
  modelPath = resolve(target);
  const { create } = await import(modelPath);
  // PROTOCOL defines ONE seed covering scalars and the occupied entity, so the
  // same construction serves all three fixture roles. That is the protocol's
  // shape, not a convenience.
  const make = async () => createBridge(create, { profile });
  factoryFor = { scalar: make, occupied: make, structural: make };
}

const suites = [
  ['scalar', S.SUPPLEMENTAL_CASES],
  ['structural', S.STRUCTURAL_CASES],
  ['authority', S.AUTHORITY_CASES],
];

const rows = [];
for (const [suite, cases] of suites) {
  let produced;
  try {
    produced = await S.runSupplemental(factoryFor, cases);
  } catch (error) {
    rows.push({ suite, id: `${suite}:<suite-aborted>`, status: 'error', detail: String(error) });
    continue;
  }
  for (const row of produced) rows.push({ suite, ...row });
}

const totals = {};
for (const row of rows) totals[row.status] = (totals[row.status] ?? 0) + 1;

writeFileSync(
  outPath,
  JSON.stringify(
    {
      provenance: {
        harness: 'SEMANTICS-2 frozen cases via shared protocol bridge',
        path: target === '--native' ? 'native (semantics-current-adapter)' : 'bridged',
        model: modelPath,
        profile,
        kernelRevision: process.env.BRIDGE_REV ?? null,
        node: process.version,
        generatedAt: new Date().toISOString(),
        sha256_16: {
          bridge: hash(resolve(here, 'bridge.mjs')),
          runner: hash(resolve(here, 'run-bridged.mjs')),
          model: modelPath ? hash(modelPath) : null,
          contract: hash(resolve(root, K, 'semantics-contract.ts')),
          supplemental: hash(resolve(root, K, 'semantics-supplemental.ts')),
          structural: hash(resolve(root, K, 'semantics-structural.ts')),
          authority: hash(resolve(root, K, 'semantics-authority.ts')),
          currentAdapter: hash(resolve(root, K, 'semantics-current-adapter.ts')),
        },
        note: 'Composition is NOT bridged; see the disposition audit.',
      },
      totals,
      rows,
    },
    null,
    2
  ) + '\n'
);
console.log(JSON.stringify({ target, profile, totals }));
