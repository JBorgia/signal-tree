#!/usr/bin/env node
// Copy only verified baseline inputs; replace explicitly selected private arms.
// Runtime payloads and common UI/oracles remain byte-identical.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const [suppliedBaseline, suppliedOut, suppliedSelection] =
  process.argv.slice(2);
assert.ok(suppliedBaseline && suppliedOut && suppliedSelection);
const baseline = resolve(suppliedBaseline);
const out = resolve(suppliedOut);
const selectionPath = resolve(suppliedSelection);
const runner = fileURLToPath(import.meta.url);
const protocol = fileURLToPath(
  new URL(
    '../../docs/audits/2026-11-11-application-comparison/IMPROVEMENTS.md',
    import.meta.url
  )
);
const sha = (path) =>
  createHash('sha256').update(readFileSync(path)).digest('hex');
const read = (path) => JSON.parse(readFileSync(path, 'utf8'));
const baselinePlanPath = join(baseline, 'plan.json');
const plan = read(baselinePlanPath);
const selection = read(selectionPath);
assert.ok(
  Array.isArray(selection.replacements) && selection.replacements.length > 0
);
assert.ok(!existsSync(out), 'Preserve prior packets');
const verify = (inputs) => {
  for (const [path, expected] of Object.entries(inputs))
    assert.equal(sha(path), expected, `Input drift: ${path}`);
};
const sourceInputs = { ...plan.inputs };
const baselineBuildInputs = {};
for (const name of ['build.json', 'dispatch-build.json']) {
  const path = join(baseline, name);
  const build = read(path);
  assert.equal(build.planSha256, sha(baselinePlanPath));
  assert.deepEqual(Object.keys(build.arms).sort(), [...plan.arms].sort());
  baselineBuildInputs[path] = sha(path);
  for (const arm of Object.values(build.arms))
    for (const [dependency, hash] of Object.entries(arm.dependencies)) {
      if (Object.hasOwn(sourceInputs, dependency))
        assert.equal(
          sourceInputs[dependency],
          hash,
          `Conflicting input: ${dependency}`
        );
      sourceInputs[dependency] = hash;
    }
}
verify({ ...sourceInputs, ...baselineBuildInputs });
const baselinePrefixes = [...new Set([baseline, realpathSync(baseline)])];
const mapped = (path) => {
  const prefix = baselinePrefixes.find((candidate) =>
    path.startsWith(candidate + sep)
  );
  return prefix ? join(out, path.slice(prefix.length + 1)) : path;
};
const inputs = { ...baselineBuildInputs };
mkdirSync(out, { recursive: true });
for (const [path, hash] of Object.entries(sourceInputs)) {
  const destination = mapped(path);
  if (destination !== path) {
    mkdirSync(dirname(destination), { recursive: true });
    copyFileSync(path, destination);
  }
  if (Object.hasOwn(inputs, destination))
    assert.equal(
      inputs[destination],
      hash,
      `Conflicting path aliases: ${destination}`
    );
  inputs[destination] = hash;
}
for (const arm of plan.arms) {
  const dependencies = join(out, arm, 'node_modules');
  mkdirSync(dependencies, { recursive: true });
  for (const name of readdirSync(join(plan.toolchainDirectory, 'node_modules')))
    if (name !== '@signal-tree')
      symlinkSync(
        join(plan.toolchainDirectory, 'node_modules', name),
        join(dependencies, name)
      );
}
const destinations = new Set();
const replacements = [];
for (const replacement of selection.replacements) {
  const { arm, scenario } = replacement;
  const source = resolve(replacement.source);
  assert.ok(plan.arms.includes(arm));
  assert.ok(['inventory', 'dispatch'].includes(scenario));
  assert.ok(source.endsWith('.ts'));
  const filename =
    scenario === 'inventory' ? 'selected.ts' : 'selected-dispatch.ts';
  const destination = join(out, arm, 'src/arms', filename);
  assert.ok(Object.hasOwn(inputs, destination));
  assert.ok(!destinations.has(destination), 'Duplicate replacement');
  destinations.add(destination);
  const beforeSha256 = inputs[destination];
  const afterSha256 = sha(source);
  assert.notEqual(beforeSha256, afterSha256, 'Replacement has no byte change');
  copyFileSync(source, destination);
  inputs[destination] = afterSha256;
  inputs[source] = afterSha256;
  replacements.push({
    arm,
    scenario,
    source,
    destination,
    beforeSha256,
    afterSha256,
  });
}
for (const path of [baselinePlanPath, selectionPath, runner, protocol])
  inputs[path] = sha(path);
verify(sourceInputs);
verify(inputs);
const artifacts = Object.fromEntries(
  Object.entries(plan.artifacts).map(([name, value]) => [
    name,
    { ...value, archive: mapped(value.archive) },
  ])
);
writeFileSync(
  join(out, 'plan.json'),
  JSON.stringify(
    {
      ...plan,
      createdUTC: new Date().toISOString(),
      inputs,
      artifacts,
      phase:
        'Private application variant: exact-build conformance before paired comparison.',
      variant: {
        baselinePlanPath,
        baselinePlanSha256: sha(baselinePlanPath),
        command: [process.execPath, runner, ...process.argv.slice(2)],
        replacements,
        limits:
          'Only specified private arm source changes. Same runtime payloads, framework/toolchain, shared UI/domain/backend and oracles. Rebuild and requalify each affected scenario; baseline receipts are not variant qualification.',
      },
    },
    null,
    2
  ) + '\n',
  { flag: 'wx' }
);
console.log('Prepared private variant', out);
