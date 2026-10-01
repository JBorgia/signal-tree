#!/usr/bin/env node
// Targeted mutation evidence, not a release-gate registration or an asymptotic
// proof. Run with the repository's Node version and installed dependencies:
//   node tools/verify-setall-neighbour-search.mjs
// One frozen spec/protocol, fresh Vitest processes, no timing threshold. Only
// private source copies are mutated. Reports and source variants stay in /tmp.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const scratch = mkdtempSync(join(tmpdir(), 'signaltree-neighbour-search-'));
const kernel = join(scratch, 'packages/kernel');
mkdirSync(kernel, { recursive: true });
cpSync(join(root, 'packages/kernel/src'), join(kernel, 'src'), {
  recursive: true,
});
for (const file of ['package.json', 'tsconfig.base.json']) {
  cpSync(join(root, file), join(scratch, file));
}
for (const file of ['package.json', 'tsconfig.json', 'tsconfig.lib.json']) {
  cpSync(join(root, 'packages/kernel', file), join(kernel, file));
}
// A private node_modules directory keeps Vite's .vite-temp writes local;
// dependency entries alone point at the already-installed workspace packages.
mkdirSync(join(scratch, 'node_modules'));
for (const name of readdirSync(join(root, 'node_modules'))) {
  if (name.startsWith('.')) continue;
  symlinkSync(
    realpathSync(join(root, 'node_modules', name)),
    join(scratch, 'node_modules', name)
  );
}
const config = readFileSync(
  join(root, 'packages/kernel/vitest.config.ts'),
  'utf8'
);
writeFileSync(
  join(kernel, 'vitest.config.ts'),
  config.replace(
    'export default defineConfig({',
    `export default defineConfig({\n  cacheDir: ${JSON.stringify(
      join(scratch, '.vite-cache')
    )},`
  )
);
const sourcePath = join(kernel, 'src/lib/entity-signal.ts');
const source = readFileSync(sourcePath, 'utf8');
const vitest = realpathSync(join(root, 'node_modules/vitest/vitest.mjs'));

function replaceOnce(input, before, after) {
  assert.equal(
    input.split(before).length - 1,
    1,
    'mutation anchor must occur once'
  );
  return input.replace(before, after);
}

// Reintroduce 7463f4eb's removed search in the CURRENT neighbour-payload loop.
// Current pre-state storage is parallel key/subject arrays, so currentKeys
// replaces the historical currentEntries tuple array. The computed position
// is used by the actual beforeSubject/afterSubject expressions, not dead work.
const neighbourMutation = replaceOnce(
  source,
  'for (const { id, entity, subjectId, index } of stagedRemovals) {',
  `for (const { id, entity, subjectId } of stagedRemovals) {
          const index = currentKeys.findIndex((entryId) => entryId === id);`
);
// A second variant moves that same search to staging, outside demand gating.
const stagingMutation = replaceOnce(
  source,
  'stagedRemovals.push({ id, entity, subjectId, index });',
  `stagedRemovals.push({
          id, entity, subjectId,
          index: currentKeys.findIndex((entryId) => entryId === id),
        });`
);

function run(label, variant, expectedFailures) {
  writeFileSync(sourcePath, variant);
  writeFileSync(join(scratch, `${label}.entity-signal.ts`), variant);
  const reportPath = join(scratch, `${label}.json`);
  const result = spawnSync(
    process.execPath,
    [
      vitest,
      'run',
      '--config',
      'vitest.config.ts',
      'src/lib/entity-large-batches.spec.ts',
      '--testNamePattern=setAll removal neighbour search work',
      '--maxWorkers=1',
      '--reporter=json',
      '--outputFile',
      reportPath,
    ],
    { cwd: kernel, encoding: 'utf8', timeout: 120_000 }
  );
  writeFileSync(
    join(scratch, `${label}.log`),
    `${result.stdout ?? ''}${result.stderr ?? ''}`
  );
  assert.ifError(result.error);
  assert.equal(result.signal, null, `${label}: process terminated`);
  assert.equal(
    result.status,
    expectedFailures ? 1 : 0,
    `${label}: unexpected exit status`
  );
  const report = JSON.parse(readFileSync(reportPath, 'utf8'));
  const tests = report.testResults.flatMap((suite) => suite.assertionResults);
  const failed = tests.filter((test) => test.status === 'failed');
  assert.equal(failed.length, expectedFailures, `${label}: wrong failures`);
  assert.equal(
    tests.filter((test) => test.status === 'passed').length,
    9 - expectedFailures
  );
  assert.equal(tests.filter((test) => test.status === 'skipped').length, 2);
  assert.equal(report.numTotalTests, 11);
  assert.equal(report.success, expectedFailures === 0);
  for (const test of failed) {
    const message = test.failureMessages.join('\n');
    assert.match(message, /findIndex predicate visits during setAll/);
    if (label === 'neighbour-mutation')
      assert.match(test.fullName, /observed tree/);
    const count = Number(test.title.match(/\((\d+) rows\)/)?.[1]);
    assert.ok(count === 256 || count === 1024, 'unexpected workload');
    assert.match(
      message,
      new RegExp(
        `expected ${
          (count * (count + 1)) / 2
        } to be less than or equal to ${count}`
      )
    );
    console.log(
      `${label}: ${test.fullName}: ${
        (count * (count + 1)) / 2
      } visits > ${count}`
    );
  }
  console.log(
    `${label}: ${9 - failed.length} passed, ${
      failed.length
    } expected failures; report ${reportPath}`
  );
}

console.log(`Isolated source snapshot and preserved evidence: ${scratch}`);
try {
  run('control', source, 0);
  run('neighbour-mutation', neighbourMutation, 4);
  run('staging-mutation', stagingMutation, 8);
} finally {
  // Also leave the private working copy clean; preserve named source variants.
  writeFileSync(sourcePath, source);
}
console.log(
  'PASS: bounded findIndex work distinguishes control from both source mutations.'
);
console.log(
  'Scope: repeated neighbour searches via findIndex; not all quadratic algorithms or overall runtime.'
);
