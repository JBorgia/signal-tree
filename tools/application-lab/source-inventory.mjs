#!/usr/bin/env node
// Maintenance surface only: comments/types/imports count; this is not bundle
// size, implementation complexity, developer productivity or economic benefit.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const [suppliedPacket, suppliedOutput] = process.argv.slice(2);
assert.ok(
  suppliedPacket && suppliedOutput,
  'source-inventory.mjs PACKET NEW_OUTPUT_JSON'
);
const packet = resolve(suppliedPacket);
const planPath = join(packet, 'plan.json');
const plan = JSON.parse(readFileSync(planPath, 'utf8'));
const sha = (data) => createHash('sha256').update(data).digest('hex');
function measure(arm, name) {
  const path = join(packet, arm, 'src', name);
  const bytes = readFileSync(path);
  const digest = sha(bytes);
  assert.equal(digest, plan.inputs[path], `Packet input drift: ${path}`);
  const lines = bytes.toString('utf8').split(/\r?\n/);
  if (lines.at(-1) === '') lines.pop();
  return {
    path,
    sha256: digest,
    utf8Bytes: bytes.length,
    physicalLines: lines.length,
    nonblankLines: lines.filter((line) => line.trim().length > 0).length,
  };
}
const arms = {};
for (const arm of plan.arms)
  arms[arm] = {
    inventory: measure(arm, 'arms/selected.ts'),
    dispatch: measure(arm, 'arms/selected-dispatch.ts'),
  };
for (const scenario of ['inventory', 'dispatch'])
  assert.equal(
    arms.v15[scenario].sha256,
    arms.v16[scenario].sha256,
    `Expected shared SignalTree ${scenario} source`
  );
const common = [
  'main.ts',
  'dispatch-main.ts',
  'model.ts',
  'dispatch-model.ts',
  'dispatch-backend.ts',
].map((name) => {
  const first = measure(plan.arms[0], name);
  for (const arm of plan.arms.slice(1))
    assert.equal(
      measure(arm, name).sha256,
      first.sha256,
      `Common source ${name}`
    );
  return first;
});
const self = fileURLToPath(import.meta.url);
writeFileSync(
  resolve(suppliedOutput),
  JSON.stringify(
    {
      command: [process.execPath, self, packet, resolve(suppliedOutput)],
      runnerSha256: sha(readFileSync(self)),
      planSha256: sha(readFileSync(planPath)),
      method:
        'UTF-8 bytes; physical newline-separated lines excluding terminal empty line; nonblank after trim. Includes comments, types and imports.',
      limits:
        'Count shared v15/v16 arm source once. Common UI/backend/model files are excluded from arm totals. Excludes dependencies, generated forwarding exports/HTML, tests, drivers and notes. Not productivity or served JavaScript.',
      arms,
      commonExcluded: common,
      signaltreeShims: Object.fromEntries(
        ['v15', 'v16'].map((arm) => [arm, measure(arm, 'st-open.ts')])
      ),
    },
    null,
    2
  ) + '\n',
  { flag: 'wx' }
);
