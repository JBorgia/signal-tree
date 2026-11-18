#!/usr/bin/env node
// Preserve the previous application strategy; compare its current packages with successors.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { inventory } from './context-strategy-common.mjs';
import { verifyExecution } from './context-strategy-execution.mjs';

const [configArg, outArg] = process.argv.slice(2);
assert(configArg && outArg);
const configPath = resolve(configArg), out = resolve(outArg), runner = fileURLToPath(import.meta.url);
assert(!existsSync(out), 'Preserve every packet');
const read = path => JSON.parse(readFileSync(path, 'utf8'));
const sha = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const config = read(configPath), baseline = realpathSync(config.baselinePacket);
const priorPlanPath = join(baseline, 'plan.json'), priorBuildPath = join(baseline, 'dispatch-build.json');
assert.equal(sha(priorPlanPath), config.baselinePlanSha256);
assert.equal(sha(priorBuildPath), config.baselineBuildSha256);
const prior = read(priorPlanPath), priorBuild = read(priorBuildPath);
assert.equal(priorBuild.planSha256, config.baselinePlanSha256);
const arms = ['native', 'ngrx', 'v15-before', 'v15', 'v16-before', 'v16', 'tanstack', 'tanstack-variant'];
assert.deepEqual(prior.arms, arms);
assert.equal(config.kind, 'startup-economics-current-to-successor-v1');
assert.deepEqual(config.profiles, [500, 10000, 50000]);
assert.deepEqual(config.currentHeads, { v15: '4e791f32238fa7bdde480c5408a23dc4a4bca804', v16: '5801008ea4ca591b3be483e8bbb0aa02e15f59ed' });
const execution = prior.optimizationComparison.execution;
verifyExecution(execution);
assert(!process.env.NODE_OPTIONS);
const toolchain = realpathSync(prior.toolchainDirectory);
const inputs = { ...prior.inputs, [runner]: sha(runner), [configPath]: sha(configPath), [priorPlanPath]: sha(priorPlanPath), [priorBuildPath]: sha(priorBuildPath) };
for (const name of ['context-strategy-common.mjs', 'context-strategy-execution.mjs']) {
  const path = join(dirname(runner), name); inputs[path] = sha(path);
}
for (const name of ['lab.mjs', 'dispatch-check.mjs', 'inventory-check.mjs']) {
  const path = resolve(dirname(runner), '../application-lab', name); inputs[path] = sha(path);
}
const verify = () => { for (const [path, expected] of Object.entries(inputs)) assert.equal(sha(path), expected, `Input drift: ${path}`); };
const copy = (source, target, expected) => {
  assert.equal(sha(source), expected); mkdirSync(dirname(target), { recursive: true });
  copyFileSync(source, target); assert.equal(sha(target), expected);
  inputs[source] = expected; inputs[target] = expected;
};
verify(); mkdirSync(out, { recursive: true });
const identities = {}, artifacts = {};
for (const arm of arms) {
  const line = arm.replace(/-before$/, ''), oldRoot = join(baseline, line), root = join(out, arm);
  const isSignalTree = line === 'v15' || line === 'v16';
  let copied = 0;
  for (const [source, expected] of Object.entries(prior.inputs)) {
    if (!source.startsWith(oldRoot + sep)) continue;
    const relative = source.slice(oldRoot.length + 1);
    if (relative.startsWith('node_modules/') || relative.startsWith('dist/')) continue;
    copy(source, join(root, relative), expected); copied++;
  }
  assert(copied > 10);
  for (const relative of ['src/dispatch-main.ts', 'src/dispatch-model.ts', 'src/dispatch-backend.ts', 'src/dispatch-arm.ts', 'src/arms/selected-dispatch.ts', 'angular.json', 'tsconfig.json', 'package.json']) assert(inputs[join(root, relative)]);
  const dependencies = join(root, 'node_modules'); mkdirSync(dependencies, { recursive: true });
  for (const name of readdirSync(join(toolchain, 'node_modules'))) if (name !== '@signal-tree') symlinkSync(join(toolchain, 'node_modules', name), join(dependencies, name));
  identities[arm] = { implementation: line, applicationSource: priorPlanPath, applicationSourceSha256: config.baselinePlanSha256 };
  if (!isSignalTree) continue;
  for (const name of ['kernel', 'angular']) {
    let packageRoot, files, identity;
    if (arm.endsWith('-before')) {
      packageRoot = join(oldRoot, 'node_modules/@signal-tree', name);
      files = Object.fromEntries(Object.entries(prior.inputs).filter(([path]) => path.startsWith(packageRoot + sep)).map(([path, expected]) => [path.slice(packageRoot.length + 1), expected]));
      assert(Object.keys(files).length >= 10);
      assert.deepEqual(inventory(packageRoot), files);
      identity = prior.artifacts[`${line}-${name}`].sourceIdentity;
      assert.equal(identity.head, config.currentHeads[line]);
    } else {
      const selected = config.successors[line][name];
      assert.equal(sha(selected.manifest), selected.manifestSha256); inputs[selected.manifest] = selected.manifestSha256;
      const manifest = read(selected.manifest); packageRoot = realpathSync(manifest.root); files = manifest.files;
      assert.equal(manifest.head, config.successorHeads[line]);
      assert.deepEqual(inventory(packageRoot), files);
      assert.equal(sha(manifest.buildReceipt), manifest.buildReceiptSha256); inputs[manifest.buildReceipt] = manifest.buildReceiptSha256;
      const receipt = read(manifest.buildReceipt); assert.equal(receipt.exitCode, 0); assert.equal(receipt.sourceUnchanged, true);
      assert.equal(manifest.head, receipt.head); assert.equal(manifest.sourceSeal, receipt.sourceSeal);
      assert(Object.keys(receipt.snapshots ?? {}).length > 0, 'Require preserved source inputs');
      for (const [path, expected] of Object.entries(receipt.snapshots ?? {})) { assert.equal(sha(path), expected); inputs[path] = expected; }
      identity = { manifest: selected.manifest, manifestSha256: selected.manifestSha256, head: manifest.head, sourceSeal: manifest.sourceSeal, publication: 'unpublished successor candidate' };
    }
    assert.equal(read(join(packageRoot, 'package.json')).name, `@signal-tree/${name}`);
    const destination = join(dependencies, '@signal-tree', name), snapshot = join(out, 'snapshots', arm, name, 'package');
    for (const [relative, expected] of Object.entries(files)) {
      copy(join(packageRoot, relative), join(destination, relative), expected);
      copy(join(packageRoot, relative), join(snapshot, relative), expected);
    }
    const archive = join(out, 'archives', `${arm}-${name}.tgz`); mkdirSync(dirname(archive), { recursive: true });
    const packed = spawnSync('tar', ['-czf', archive, '-C', dirname(snapshot), 'package'], { encoding: 'utf8', env: { ...process.env, COPYFILE_DISABLE: '1' } });
    assert.equal(packed.status, 0, packed.stderr);
    const listed = spawnSync('tar', ['-tzf', archive], { encoding: 'utf8' }); assert.equal(listed.status, 0);
    assert.deepEqual(listed.stdout.trim().split('\n').filter(path => !path.endsWith('/')).sort(), Object.keys(files).map(path => `package/${path}`).sort());
    inputs[archive] = sha(archive);
    artifacts[`${arm}-${name}`] = { archive, integrity: 'sha512-' + createHash('sha512').update(readFileSync(archive)).digest('base64'), sourceIdentity: identity, unpublished: true };
    identities[arm][name] = identity;
  }
  for (const key of ['head', 'sourceSeal']) assert.equal(identities[arm].kernel[key], identities[arm].angular[key], `One source identity required: ${arm}`);
  assert.equal(read(join(dependencies, '@signal-tree/angular/package.json')).dependencies['@signal-tree/kernel'], read(join(dependencies, '@signal-tree/kernel/package.json')).version);
}
verify(); verifyExecution(execution);
writeFileSync(join(out, 'plan.json'), JSON.stringify({
  ...prior, arms, inputs, artifacts, createdUTC: new Date().toISOString(), phase: 'Unbuilt current-to-successor startup economics',
  runtimeRefresh: { identities },
  optimizationComparison: { ...prior.optimizationComparison, baselinePlanPath: priorPlanPath, baselinePlanSha256: config.baselinePlanSha256, derivations: [], command: [process.execPath, ...process.argv.slice(1)], limits: 'Unchanged production application strategies; before arms are the current qualified November 17 packages. Three resident-data tiers do not establish representative industries or complete native-contract equivalence.' },
  startupEconomics: { profiles: config.profiles, currentHeads: config.currentHeads, applicationSourceUnchanged: true, plannedChildren: 288, sameArtifactArms: ['v15', 'v16'] },
}, null, 2) + '\n', { flag: 'wx' });
console.log(out);
