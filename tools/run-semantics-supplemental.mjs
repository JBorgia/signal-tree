#!/usr/bin/env node
// Read-only candidate source selection; no checkout, production edits or model changes.
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
if (
  (args.length !== 2 && args.length !== 3) ||
  !['baseline', 'current'].includes(args[0]) ||
  (args[2] && !['structural', 'composition', 'authority'].includes(args[2]))
) {
  console.error(
    'Usage: node tools/run-semantics-supplemental.mjs baseline|current OUTPUT.json [structural|composition|authority]'
  );
  process.exit(2);
}
const [mode, output] = args;
const suite = args[2] ?? 'scalar';
if (existsSync(output))
  throw new Error(
    'Evidence output exists; choose a new path to preserve earlier results.'
  );
const revision = '7ade0e3ecb25ff0d06da4355b5f7d67844e147b7';
const harness = new Set(
  [
    'semantics-contract.ts',
    'semantics-current-adapter.ts',
    'semantics-supplemental.ts',
    'semantics-structural.ts',
    'semantics-structural-domain.ts',
    'semantics-structural-adapter.ts',
    'semantics-composition.ts',
    'semantics-composition-domain.ts',
    'semantics-composition-adapter.ts',
    'semantics-authority.ts',
  ].map((name) => `packages/kernel/src/enhancers/transactions/${name}`)
);
const hash = (contents) => createHash('sha256').update(contents).digest('hex');
const inputs = {};
inputs['tools/run-semantics-supplemental.mjs'] = {
  sha256: hash(readFileSync(fileURLToPath(import.meta.url))),
  source: 'working-tree',
};
if (['structural', 'composition', 'authority'].includes(suite)) {
  const path =
    suite === 'structural'
      ? 'docs/audits/2026-09-23-semantics-structural/FROZEN-v2.json'
      : suite === 'composition'
      ? 'docs/audits/2026-09-23-semantics-composition/FROZEN-v3.json'
      : 'docs/audits/2026-09-23-semantics-authority/FROZEN.json';
  const content = readFileSync(resolve(root, path), 'utf8');
  inputs[path] = { sha256: hash(content), source: 'working-tree' };
  for (const [source, expected] of Object.entries(
    JSON.parse(content).sources
  )) {
    const actual = hash(readFileSync(resolve(root, source), 'utf8'));
    if (actual !== expected)
      throw new Error(`Frozen oracle changed before execution: ${source}`);
    inputs[source] = { sha256: actual, source: 'working-tree' };
  }
}
const bundle = await build({
  stdin: {
    contents:
      suite === 'authority'
        ? `import {makeCurrent} from './packages/kernel/src/enhancers/transactions/semantics-current-adapter';\nimport {AUTHORITY_CASES} from './packages/kernel/src/enhancers/transactions/semantics-authority';\nimport {runSupplemental,supplementalExitCode} from './packages/kernel/src/enhancers/transactions/semantics-supplemental';\nexport async function run(){const rows=await runSupplemental({scalar:makeCurrent,occupied:makeCurrent},AUTHORITY_CASES);return {rows,exitCode:supplementalExitCode(rows)};}`
        : suite === 'composition'
        ? `import {makeComposition} from './packages/kernel/src/enhancers/transactions/semantics-composition-adapter';\nimport {COMBINATIONS} from './packages/kernel/src/enhancers/transactions/semantics-composition-domain';\nimport {COMPOSITION_CASES} from './packages/kernel/src/enhancers/transactions/semantics-composition';\nimport {runSupplemental,supplementalExitCode} from './packages/kernel/src/enhancers/transactions/semantics-supplemental';\nexport async function run(){const rows=[];for(const combination of COMBINATIONS){const factory=()=>makeComposition(combination);const results=await runSupplemental({scalar:factory,occupied:factory},COMPOSITION_CASES);rows.push(...results.map(row=>({...row,id:combination.id+'/'+row.id})));}return {rows,exitCode:supplementalExitCode(rows)};}`
        : suite === 'structural'
        ? `import {makeStructural} from './packages/kernel/src/enhancers/transactions/semantics-structural-adapter';\nimport {runSupplemental,supplementalExitCode} from './packages/kernel/src/enhancers/transactions/semantics-supplemental';\nimport {STRUCTURAL_CASES} from './packages/kernel/src/enhancers/transactions/semantics-structural';\nexport async function run(){const rows=await runSupplemental({scalar:makeStructural,occupied:makeStructural,structural:makeStructural},STRUCTURAL_CASES);return {rows,exitCode:supplementalExitCode(rows)};}`
        : `import {makeCurrent,makeOccupiedConflict} from './packages/kernel/src/enhancers/transactions/semantics-current-adapter';\nimport {runSupplemental,supplementalExitCode} from './packages/kernel/src/enhancers/transactions/semantics-supplemental';\nexport async function run(){const rows=await runSupplemental({scalar:makeCurrent,occupied:makeOccupiedConflict});return {rows,exitCode:supplementalExitCode(rows)};}`,
    resolveDir: root,
    loader: 'ts',
  },
  absWorkingDir: root,
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
  target: 'node24',
  plugins: [
    {
      name: 'record-exact-candidate-source',
      setup(builder) {
        builder.onLoad(
          { filter: /\/packages\/kernel\/src\/.*\.ts$/ },
          ({ path }) => {
            const name = relative(root, path);
            const contents =
              mode === 'baseline' && !harness.has(name)
                ? execFileSync('git', ['show', `${revision}:${name}`], {
                    cwd: root,
                    encoding: 'utf8',
                    maxBuffer: 16 * 1024 * 1024,
                  })
                : readFileSync(path, 'utf8');
            inputs[name] = {
              sha256: hash(contents),
              source:
                mode === 'baseline' && !harness.has(name)
                  ? revision
                  : 'working-tree',
            };
            return { contents, loader: 'ts', resolveDir: dirname(path) };
          }
        );
      },
    },
  ],
});
const executable = await import(
  `data:text/javascript;base64,${Buffer.from(
    bundle.outputFiles[0].text
  ).toString('base64')}`
);
const result = await executable.run();
const changedInputs = Object.entries(inputs)
  .filter(
    ([path, entry]) =>
      entry.source === 'working-tree' &&
      hash(readFileSync(resolve(root, path), 'utf8')) !== entry.sha256
  )
  .map(([path]) => path);
const totals = Object.fromEntries(
  ['held', 'violated', 'unsupported', 'not-exercised', 'error'].map(
    (status) => [
      status,
      result.rows.filter((row) => row.status === status).length,
    ]
  )
);
const report = {
  mode,
  suite,
  baseline: revision,
  timestamp: new Date().toISOString(),
  scope:
    'Supplemental assertions only; no whole-law or release verdict. Refusal safety is separate from successful surgical settlement.',
  inputs,
  changedInputs,
  totals,
  ...result,
};
writeFileSync(
  output,
  JSON.stringify(
    report,
    (_key, value) =>
      value instanceof Error
        ? { name: value.name, message: value.message, cause: value.cause }
        : value,
    2
  ) + '\n'
);
console.log(JSON.stringify({ mode, suite, totals, changedInputs, output }));
process.exitCode = changedInputs.length ? 2 : result.exitCode;
