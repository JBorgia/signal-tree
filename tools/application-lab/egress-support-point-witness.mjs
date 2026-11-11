#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const [witnessInput, entryInput, outputInput] = process.argv.slice(2);
assert.ok(
  witnessInput && entryInput && outputInput,
  'Pass ORIGINAL_COUNTER_CHILD BUILT_KERNEL_ENTRY NEW_OUTPUT'
);
const witness = resolve(witnessInput),
  entry = resolve(entryInput),
  output = resolve(outputInput);
assert.ok(!existsSync(output), 'Preserve earlier witnesses');
mkdirSync(output, { recursive: true });
const sha = (path) =>
  createHash('sha256').update(readFileSync(path)).digest('hex');
const bindings = {};
function bind(directory) {
  for (const item of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, item.name);
    if (item.isDirectory()) bind(path);
    else if (item.isFile()) bindings[path] = sha(path);
    else throw new Error('Unexpected artifact entry ' + path);
  }
}
bind(dirname(entry));
const copied = {};
for (const [name, path] of [
  ['counter-child.mjs', witness],
  ['original-counter.mjs', join(dirname(witness), 'original-counter.mjs')],
]) {
  bindings[path] = sha(path);
  const copy = join(output, name);
  cpSync(path, copy);
  assert.equal(sha(copy), bindings[path]);
  copied[path] = copy;
}
const command = [witness, 'v16', entry];
const child = spawnSync(process.execPath, command, {
  encoding: 'utf8',
  timeout: 120000,
  env: { ...process.env, NODE_ENV: 'production' },
});
const stdout = join(output, 'stdout.json'),
  stderr = join(output, 'stderr.log');
writeFileSync(stdout, child.stdout ?? '', { flag: 'wx' });
writeFileSync(stderr, child.stderr ?? '', { flag: 'wx' });
const receipt = {
  command: [process.execPath, ...command],
  wrapperCommand: [process.execPath, ...process.argv.slice(1)],
  wrapperSha256: sha(process.argv[1]),
  bindings,
  copied,
  exit: child.status,
  signal: child.signal,
  stdoutSha256: sha(stdout),
  stderrSha256: sha(stderr),
  passed: false,
};
try {
  assert.equal(child.status, 0);
  const result = JSON.parse(child.stdout);
  assert.deepEqual(
    result.rows.map((row) => row.size),
    [2000, 20000]
  );
  for (const row of result.rows) {
    assert.ok(
      row.total < 2000,
      `Original point bound failed at ${row.size}: ${row.total}`
    );
    assert.equal(row.passesOriginalBound, true);
    assert.equal(row.widthControl, 2 * row.size);
  }
  assert.equal(result.rows[0].total, result.rows[1].total);
  assert.equal(result.plantedCharge, 7);
  assert.equal(result.throwUndefinedPreserved, true);
  receipt.passed = true;
} catch (error) {
  receipt.error = String(error?.stack ?? error);
  process.exitCode = 1;
} finally {
  writeFileSync(
    join(output, 'receipt.json'),
    JSON.stringify(receipt, null, 2) + '\n',
    { flag: 'wx' }
  );
}
console.log(
  JSON.stringify({ passed: receipt.passed, output, exit: child.status })
);
