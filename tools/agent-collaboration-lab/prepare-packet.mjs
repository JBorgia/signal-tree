#!/usr/bin/env node
// Verify/copy frozen installed inputs. Build and conformance are separate phases.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveHistoricalInputs } from './historical-inputs.mjs';

const [configArg, outArg] = process.argv.slice(2);
assert(configArg && outArg);
const configPath = resolve(configArg), out = resolve(outArg), runner = fileURLToPath(import.meta.url);
assert(!existsSync(out), 'Preserve prior packet');
const read = path => JSON.parse(readFileSync(path, 'utf8'));
const sha = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const config = read(configPath), baseline = realpathSync(config.baselinePacket), planPath = join(baseline, 'plan.json');
assert.equal(sha(planPath), config.baselinePlanSha256);
const plan = read(planPath);
let sourceInputs = { ...plan.inputs, [planPath]: sha(planPath), [configPath]: sha(configPath), [runner]: sha(runner) };
const resolver = join(dirname(runner), 'historical-inputs.mjs'); sourceInputs[resolver] = sha(resolver);
const requiredLive = new Set([planPath, configPath, runner, resolver]);
for (const filename of ['build.json', 'dispatch-build.json']) {
  const path = join(baseline, filename), built = read(path);
  assert.equal(built.planSha256, sha(planPath)); sourceInputs[path] = sha(path);
  requiredLive.add(path);
  for (const arm of Object.values(built.arms)) { Object.assign(sourceInputs, arm.dependencies); for (const dependency of Object.keys(arm.dependencies)) requiredLive.add(dependency); }
}
const historical = resolveHistoricalInputs(sourceInputs, requiredLive, config.historicalEvidence);
sourceInputs = historical.bindings;
const verify = inputs => { for (const [path, hash] of Object.entries(inputs)) assert.equal(sha(path), hash, `Input drift ${path}`); };
verify(sourceInputs);
// A recovered toolchain may live in persistent storage. Its lockfile and every
// previously bound dependency must match; this is a location change, not an upgrade.
const toolchainDirectory = realpathSync(config.toolchainDirectory ?? plan.toolchainDirectory);
if (toolchainDirectory !== realpathSync(plan.toolchainDirectory)) {
  for (const name of ['package.json', 'package-lock.json']) {
    const path = join(toolchainDirectory, name);
    assert.equal(sha(path), sha(join(plan.toolchainDirectory, name)), `Recovered toolchain ${name} differs`);
    sourceInputs[path] = sha(path);
  }
  const oldPrefixes = [...new Set([plan.toolchainDirectory, realpathSync(plan.toolchainDirectory)])].map(path => path + sep);
  let checkedDependencies = 0;
  for (const [path, expected] of Object.entries(sourceInputs)) {
    const oldPrefix = oldPrefixes.find(prefix => path.startsWith(prefix));
    if (!oldPrefix) continue;
    const replacement = join(toolchainDirectory, path.slice(oldPrefix.length));
    assert.equal(sha(replacement), expected, `Recovered dependency differs: ${replacement}`);
    sourceInputs[replacement] = expected;
    if (path.slice(oldPrefix.length).startsWith('node_modules/')) checkedDependencies++;
  }
  assert(checkedDependencies > 0, 'No recovered toolchain dependencies were verified');
}
const files = root => readdirSync(root, { withFileTypes: true }).flatMap(entry => {
  assert(!entry.isSymbolicLink(), 'Package snapshots must contain payloads, not aliases');
  const path = join(root, entry.name); return entry.isDirectory() ? files(path) : [path];
}).sort();
for (const [line, packages] of Object.entries(config.packages)) {
  assert(['v15', 'v16'].includes(line));
  for (const [name, pkg] of Object.entries(packages)) {
    assert(['kernel', 'angular'].includes(name));
    assert.equal(sha(pkg.receipt), pkg.receiptSha256); sourceInputs[pkg.receipt] = pkg.receiptSha256;
    let payload = read(pkg.receipt);
    for (const key of pkg.payloadKeys) { assert(payload && Object.hasOwn(payload, key), 'Missing receipt payload'); payload = payload[key]; }
    const entries = Array.isArray(payload) ? payload.map(file => [file.path, file.sha256]) : Object.entries(payload).map(([key, value]) => [key, typeof value === 'string' ? value : value.sha256]);
    const derived = Object.fromEntries(entries.filter(([key]) => !pkg.keyPrefix || key.startsWith(pkg.keyPrefix)).map(([key, hash]) => [pkg.keyPrefix ? key.slice(pkg.keyPrefix.length) : key, hash]));
    assert(Object.keys(derived).length >= 10, 'No package inventory in bound receipt');
    assert(Object.values(derived).every(hash => /^[a-f0-9]{64}$/.test(hash)), 'Invalid package digest');
    assert.deepEqual(pkg.files, derived, 'Configured files must equal the source receipt inventory');
    const root = realpathSync(pkg.root), actual = files(root).map(path => path.slice(root.length + 1));
    assert.deepEqual(actual, Object.keys(pkg.files).sort(), 'Package inventory differs from frozen receipt');
    for (const [relative, hash] of Object.entries(pkg.files)) {
      assert(!relative.startsWith('/') && !relative.split('/').includes('..'));
      const path = join(root, relative); assert.equal(sha(path), hash); sourceInputs[path] = hash;
    }
    const manifest = read(join(root, 'package.json'));
    assert.equal(manifest.name, '@signal-tree/' + name);
    if (name === 'angular') assert.equal(manifest.dependencies['@signal-tree/kernel'], read(join(packages.kernel.root, 'package.json')).version);
  }
}
mkdirSync(out, { recursive: true });
const inputs = { ...sourceInputs }, artifacts = {}, identities = {};
const copy = (source, destination) => { mkdirSync(dirname(destination), { recursive: true }); copyFileSync(source, destination); inputs[destination] = sha(destination); };
const arms = ['native', 'ngrx', 'v15', 'v16', 'tanstack', 'tanstack-variant'];
for (const arm of arms) {
  const sourceRoot = realpathSync(join(baseline, arm)), destination = join(out, arm);
  for (const path of Object.keys(sourceInputs)) {
    const actual = realpathSync(path);
    if (!actual.startsWith(sourceRoot + sep)) continue;
    const relative = actual.slice(sourceRoot.length + 1);
    if (relative.startsWith('node_modules/') || relative.startsWith('dist/')) continue;
    copy(actual, join(destination, relative));
  }
  const dependencies = join(destination, 'node_modules'); mkdirSync(dependencies, { recursive: true });
  for (const name of readdirSync(join(toolchainDirectory, 'node_modules'))) if (name !== '@signal-tree') symlinkSync(join(toolchainDirectory, 'node_modules', name), join(dependencies, name));
  if (config.packages[arm]) {
    for (const [name, pkg] of Object.entries(config.packages[arm])) {
      const root = realpathSync(pkg.root);
      for (const relative of Object.keys(pkg.files)) copy(join(root, relative), join(dependencies, '@signal-tree', name, relative));
      const snapshot = join(out, 'snapshots', arm, name, 'package');
      for (const relative of Object.keys(pkg.files)) copy(join(root, relative), join(snapshot, relative));
      const archive = join(out, 'archives', `${arm}-${name}.tgz`); mkdirSync(dirname(archive), { recursive: true });
      const packed = spawnSync('tar', ['-czf', archive, '-C', dirname(snapshot), 'package'], { encoding: 'utf8', env: { ...process.env, COPYFILE_DISABLE: '1' } });
      assert.equal(packed.status, 0, packed.stderr); inputs[archive] = sha(archive);
      const listing = spawnSync('tar', ['-tzf', archive], { encoding: 'utf8' });
      assert.equal(listing.status, 0, listing.stderr);
      assert.deepEqual(listing.stdout.trim().split('\n').filter(path => !path.endsWith('/')).sort(), Object.keys(pkg.files).map(path => 'package/' + path).sort(), 'Archive must contain exactly the verified package files, without filesystem metadata payloads');
      artifacts[`${arm}-${name}`] = { archive, integrity: 'sha512-' + createHash('sha512').update(readFileSync(archive)).digest('base64'), sourceIdentity: pkg.sourceIdentity, sourceReceipt: pkg.receipt, unpublished: true };
    }
    identities[arm] = config.packages[arm].kernel.sourceIdentity;
  } else identities[arm] = plan.runtimeRefresh?.identities[arm] ?? { implementation: arm };
  for (const relative of ['src/dispatch-main.ts', 'src/dispatch-model.ts', 'src/dispatch-backend.ts', 'src/dispatch-arm.ts', 'src/arms/selected-dispatch.ts', 'angular.json', 'tsconfig.json', 'package.json']) assert.equal(sha(join(destination, relative)), sha(join(sourceRoot, relative)), `Common/selected app input changed: ${arm}/${relative}`);
}
verify(inputs);
writeFileSync(join(out, 'plan.json'), JSON.stringify({ ...plan, toolchainDirectory, createdUTC: new Date().toISOString(), arms, inputs, artifacts, phase: 'Exact successor installed inputs; unbuilt and unqualified', runtimeRefresh: { baselinePlanPath: planPath, baselinePlanSha256: sha(planPath), command: [process.execPath, ...process.argv.slice(1)], identities, historicalVersions: historical.versions, limits: 'Package payload refresh only. Original/common application strategies unchanged. Fresh build and conformance required.' } }, null, 2) + '\n', { flag: 'wx' });
console.log(out);
