#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const [line, suppliedPackage, output] = process.argv.slice(2);
assert.ok(['v15', 'v16'].includes(line) && suppliedPackage && output);
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
const entry = manifest.exports['.'].import;
assert.equal(manifest.name, '@signal-tree/kernel');
assert.ok(manifest.version.startsWith(line.slice(1) + '.'));
const { signalTree, entityMap, transactions } = await import(
  pathToFileURL(resolve(directory, entry)).href
);
const traces = [];
for (const a of ['confirm', 'rollback'])
  for (const b of ['confirm', 'rollback'])
    for (const order of [
      ['A', 'B'],
      ['B', 'A'],
    ]) {
      const tree = signalTree(
        { proposals: entityMap({ selectId: (value) => value.id }) },
        { enhancers: [transactions()] }
      );
      const begin =
        line === 'v15'
          ? (work) => tree.transaction(work)
          : (work) => tree.transact(work);
      const values = {
        A: { id: 'A', subject: 'J-0', field: 'status', value: 'active' },
        B: { id: 'B', subject: 'J-0', field: 'owner', value: 'Lee' },
      };
      const handles = {};
      const stages = [];
      try {
        handles.A = begin(() => tree.$.proposals.addOne(values.A));
        handles.B = begin(() => tree.$.proposals.addOne(values.B));
        assert.deepEqual(tree.$.proposals.all(), [values.A, values.B]);
        const expected = new Map(Object.entries(values));
        for (const id of order) {
          const decision = id === 'A' ? a : b;
          handles[id][decision]();
          if (decision === 'confirm') tree.$.proposals.removeOne(id);
          expected.delete(id);
          assert.deepEqual(tree.$.proposals.all(), [...expected.values()]);
          stages.push({ id, decision, remaining: tree.$.proposals.all() });
        }
        traces.push({ a, b, order, stages, passed: true });
      } catch (error) {
        traces.push({
          a,
          b,
          order,
          stages,
          passed: false,
          error: String(error.stack),
        });
      } finally {
        tree.destroy();
      }
    }
for (const [path, expected] of Object.entries(bindings))
  assert.equal(sha(path), expected);
writeFileSync(
  resolve(output),
  JSON.stringify(
    {
      line,
      version: manifest.version,
      node: process.version,
      runnerSha256: sha(fileURLToPath(import.meta.url)),
      packageHashes: bindings,
      traces,
      limitation:
        'Unique pending proposal membership controls only, no complete application or Angular claim.',
    },
    null,
    2
  ) + '\n',
  { flag: 'wx' }
);
console.log(
  JSON.stringify({
    line,
    passed: traces.filter((item) => item.passed).length,
    total: traces.length,
  })
);
if (traces.some((item) => !item.passed)) process.exitCode = 1;
