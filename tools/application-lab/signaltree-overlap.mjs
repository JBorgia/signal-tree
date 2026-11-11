#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const [line, suppliedPackage, output] = process.argv.slice(2);
assert.ok(
  ['v15', 'v16'].includes(line) && suppliedPackage && output,
  'signaltree-overlap.mjs v15|v16 PACKAGE_DIRECTORY OUTPUT_JSON'
);
const directory = resolve(suppliedPackage);
const sha = (path) =>
  createHash('sha256').update(readFileSync(path)).digest('hex');
const files = (path) =>
  readdirSync(path, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? files(join(path, entry.name))
      : [join(path, entry.name)]
  );
const bindings = Object.fromEntries(
  files(directory).map((path) => [path, sha(path)])
);
const manifest = JSON.parse(
  readFileSync(join(directory, 'package.json'), 'utf8')
);
assert.equal(manifest.name, '@signal-tree/kernel');
assert.equal(manifest.version.startsWith(line.slice(1) + '.'), true);
const entry = manifest.exports['.'].import;
const entryPath = resolve(
  directory,
  typeof entry === 'string' ? entry : entry.default
);
const { signalTree, entityMap, transactions } = await import(
  pathToFileURL(entryPath).href
);
const seed = { id: 'A', status: 'queued', owner: 'Sam' };
const traces = [];
const make = () => {
  const tree = signalTree(
    { rows: entityMap({ selectId: (row) => row.id }) },
    { enhancers: [transactions()] }
  );
  tree.$.rows.addOne({ ...seed });
  const begin =
    line === 'v15'
      ? (work) => tree.transaction(work)
      : (work) => tree.transact(work);
  const row = () => {
    const value = tree.$.rows.byIdOrFail('A')();
    return { id: value.id, status: value.status, owner: value.owner };
  };
  return { tree, begin, row };
};
for (const decision of ['confirm', 'rollback']) {
  const { tree, begin, row } = make();
  try {
    const handle = begin(() => tree.$.rows.updateOne('A', { owner: 'Lee' }));
    assert.deepEqual(row(), { ...seed, owner: 'Lee' });
    handle[decision]();
    assert.deepEqual(row(), {
      ...seed,
      owner: decision === 'confirm' ? 'Lee' : 'Sam',
    });
    traces.push({ name: `single-${decision}`, passed: true });
  } finally {
    tree.destroy();
  }
}
for (const aDecision of ['confirm', 'rollback'])
  for (const bDecision of ['confirm', 'rollback']) {
    for (const order of [
      ['a', 'b'],
      ['b', 'a'],
    ]) {
      const { tree, begin, row } = make();
      try {
        const a = begin(() => tree.$.rows.updateOne('A', { status: 'active' }));
        assert.deepEqual(row(), { ...seed, status: 'active' });
        const b = begin(() => tree.$.rows.updateOne('A', { owner: 'Lee' }));
        assert.deepEqual(row(), { ...seed, status: 'active', owner: 'Lee' });
        const handles = { a, b },
          requested = { a: aDecision, b: bDecision };
        const expected = { ...seed, status: 'active', owner: 'Lee' };
        const stages = [];
        for (const actor of order) {
          let failure = null;
          try {
            handles[actor][requested[actor]]();
          } catch (error) {
            failure = {
              name: error.name,
              code: error.code,
              message: error.message,
              causeKind: error.cause?.kind,
            };
          }
          if (requested[actor] === 'rollback')
            expected[actor === 'a' ? 'status' : 'owner'] =
              actor === 'a' ? 'queued' : 'Sam';
          const actual = row();
          stages.push({
            actor,
            requested: requested[actor],
            actual,
            expected: { ...expected },
            failure,
            passed:
              !failure && JSON.stringify(actual) === JSON.stringify(expected),
          });
        }
        traces.push({
          name: 'independent-fields',
          aDecision,
          bDecision,
          order,
          stages,
          nativeBusinessContractPass: stages.every((stage) => stage.passed),
        });
      } finally {
        tree.destroy();
      }
    }
  }
// Deliberate same-field refusal is a separate native limit, not an independent-
// field failure. Verify the older handle remains usable after newer rollback.
{
  const { tree, begin, row } = make();
  try {
    const a = begin(() => tree.$.rows.updateOne('A', { owner: 'Ada' }));
    const b = begin(() => tree.$.rows.updateOne('A', { owner: 'Bea' }));
    let refusal;
    try {
      a.rollback();
    } catch (error) {
      refusal = {
        name: error.name,
        code: error.code,
        message: error.message,
        causeKind: error.cause?.kind,
      };
    }
    assert.ok(refusal, 'Expected supported same-field refusal');
    assert.deepEqual(row(), { ...seed, owner: 'Bea' });
    b.rollback();
    a.rollback();
    assert.deepEqual(row(), seed);
    traces.push({
      name: 'same-field-refusal-control',
      refusal,
      recovered: row(),
      passed: true,
    });
  } finally {
    tree.destroy();
  }
}
for (const [path, expected] of Object.entries(bindings))
  assert.equal(sha(path), expected, 'Artifact changed');
const result = {
  line,
  version: manifest.version,
  node: process.version,
  entryPath,
  runnerSha256: sha(fileURLToPath(import.meta.url)),
  packageHashes: bindings,
  traces,
  limitation:
    'Public neutral synchronous state/settlement probes. Not transport, Link, Angular rendering or application economics.',
};
writeFileSync(resolve(output), JSON.stringify(result, null, 2) + '\n', {
  flag: 'wx',
});
console.log(
  JSON.stringify({
    line,
    traces: traces.length,
    independentFailures: traces.filter(
      (item) => item.nativeBusinessContractPass === false
    ).length,
  })
);
if (traces.some((item) => item.nativeBusinessContractPass === false))
  process.exitCode = 1;
