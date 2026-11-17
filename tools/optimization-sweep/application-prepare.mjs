#!/usr/bin/env node
// New eight-arm packet: pinned peers and same-strategy before/after runtimes.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { inventory } from './context-strategy-common.mjs';
import { verifyExecution } from './context-strategy-execution.mjs';

const [configArg, outputArg] = process.argv.slice(2);
assert(configArg && outputArg);
const configPath = resolve(configArg), out = resolve(outputArg), runner = fileURLToPath(import.meta.url);
assert(!existsSync(out), 'Preserve every previous packet');
const read = path => JSON.parse(readFileSync(path, 'utf8'));
const sha = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const config = read(configPath), baseline = realpathSync(config.baselinePacket);
const oldPlanPath = join(baseline, 'plan.json'), oldBuildPath = join(baseline, 'dispatch-build.json');
assert.equal(sha(oldPlanPath), config.baselinePlanSha256);
assert.equal(sha(oldBuildPath), config.baselineDispatchBuildSha256);
const original = read(oldPlanPath), built = read(oldBuildPath);
assert.equal(built.planSha256, config.baselinePlanSha256);
const toolchain = realpathSync(original.toolchainDirectory);
assert.equal(toolchain, config.execution.toolchainDirectory);
verifyExecution(config.execution);
assert(!process.env.NODE_OPTIONS, 'Unregistered Node flags');
const arms = ['native', 'ngrx', 'v15-before', 'v15', 'v16-before', 'v16', 'tanstack', 'tanstack-variant'];
const inputs = { [runner]: sha(runner), [configPath]: sha(configPath), [oldPlanPath]: sha(oldPlanPath), [oldBuildPath]: sha(oldBuildPath) };
for (const name of ['package.json', 'package-lock.json']) {
  const path = join(toolchain, name); assert.equal(sha(path), original.inputs[path], 'Pinned application toolchain input'); inputs[path] = sha(path);
}
for (const name of ['lab.mjs', 'dispatch-check.mjs', 'inventory-check.mjs']) {
  const path = resolve(dirname(runner), '../application-lab', name); inputs[path] = sha(path);
}
for (const name of ['context-strategy-common.mjs', 'context-strategy-execution.mjs']) { const path = join(dirname(runner), name); inputs[path] = sha(path); }
// The peer strategy is a reviewed app overlay, separate from runtime changes.
const peerArms = ['native', 'ngrx', 'tanstack', 'tanstack-variant'];
const peerConfig = config.peerBulkContext;
assert(peerConfig, 'Exact reviewed peer bulk-context configuration is required');
assert.equal(peerConfig.receiptSha256, 'fdb12664e01e4a2cc604cfaae96a664d0eff0ba5e488faa0550c69558fb94e39');
assert.equal(peerConfig.derivationSha256, 'aae109d61e1aff7fa69c29d97d81ed03a7b0fe210590b44af420955dad16d574');
assert.equal(sha(peerConfig.receipt), peerConfig.receiptSha256);
assert.equal(sha(peerConfig.derivation), peerConfig.derivationSha256);
inputs[peerConfig.receipt] = peerConfig.receiptSha256;
inputs[peerConfig.derivation] = peerConfig.derivationSha256;
const peerReceipt = read(peerConfig.receipt), peerDerivation = read(peerConfig.derivation);
assert.equal(peerReceipt.kind, 'peer-bulk-context-proposal-receipt-v1');
assert.equal(peerDerivation.baselinePlanSha256, config.baselinePlanSha256);
assert.equal(peerDerivation.baselineDispatchBuildSha256, config.baselineDispatchBuildSha256);
assert.deepEqual(Object.keys(peerConfig.arms).sort(), [...peerArms].sort());
assert.deepEqual(Object.keys(peerDerivation.derivations).sort(), [...peerArms].sort());
for (const [relative, expected] of Object.entries(peerReceipt.files)) {
  const path = resolve(dirname(peerConfig.receipt), relative);
  assert(path.startsWith(dirname(resolve(peerConfig.receipt)) + sep));
  assert.equal(sha(path), expected, 'Sealed peer proposal file'); inputs[path] = expected;
}
for (const arm of peerArms) {
  const selected = peerDerivation.derivations[arm], configured = peerConfig.arms[arm];
  assert.equal(configured.baseSha256, selected.inputSha256);
  assert.equal(configured.overlaySha256, selected.overlaySha256);
  assert.equal(selected.input, join(baseline, arm, 'src/arms/selected-dispatch.ts'));
  for (const [path, expected] of [[selected.baseCopy, configured.baseSha256], [selected.overlay, configured.overlaySha256]]) {
    assert.equal(sha(path), expected, 'Exact reviewed base/overlay');
    assert.equal(inputs[path], expected, 'Peer file must belong to sealed receipt');
  }
}
const contextStrategies = {
  native: 'existing-eager-record-views', ngrx: 'entity-map-shared-projection',
  'v15-before': 'asMap-shared-projection', v15: 'asMap-shared-projection',
  'v16-before': 'asMap-shared-projection', v16: 'asMap-shared-projection',
  tanstack: 'direct-collection-get-shared-projection', 'tanstack-variant': 'direct-collection-get-shared-projection',
};
const identities = {}, artifacts = {}, derivations = [];
const verify = () => { for (const [path, expected] of Object.entries(inputs)) assert.equal(sha(path), expected, `Input drift: ${path}`); };
const copy = (source, destination, expected) => {
  assert.equal(sha(source), expected); mkdirSync(dirname(destination), { recursive: true });
  copyFileSync(source, destination); assert.equal(sha(destination), expected);
  inputs[source] = expected; inputs[destination] = expected;
};
const replaceOnce = (text, before, after) => { assert.equal(text.split(before).length, 2, `Source anchor: ${before}`); return text.replace(before, after); };
const edit = (path, transform) => {
  const before = readFileSync(path, 'utf8'), beforeSha256 = sha(path), after = transform(before);
  assert.notEqual(before, after); writeFileSync(path, after); inputs[path] = sha(path);
  derivations.push({ path, beforeSha256, afterSha256: sha(path) });
};
mkdirSync(out, { recursive: true });
for (const arm of arms) {
  const oldArm = arm.replace(/-before$/, ''), root = join(out, arm), oldRoot = join(baseline, oldArm);
  assert(original.arms.includes(oldArm));
  for (const [path, expected] of Object.entries(built.arms[oldArm].dependencies)) { assert.equal(sha(path), expected); inputs[path] = expected; }
  let copied = 0;
  for (const [path, expected] of Object.entries(original.inputs)) if (path.startsWith(oldRoot + sep)) {
    const relative = path.slice(oldRoot.length + 1);
    if (relative.startsWith('node_modules/') || relative.startsWith('dist/')) continue;
    copy(path, join(root, relative), expected); copied++;
  }
  assert(copied > 10);
  for (const relative of ['src/dispatch-main.ts', 'src/dispatch-model.ts', 'src/dispatch-backend.ts', 'src/dispatch-arm.ts', 'src/arms/selected-dispatch.ts', 'angular.json', 'tsconfig.json', 'package.json']) assert(inputs[join(root, relative)]);
  const dependencies = join(root, 'node_modules'); mkdirSync(dependencies, { recursive: true });
  for (const name of readdirSync(join(toolchain, 'node_modules'))) if (name !== '@signal-tree') symlinkSync(join(toolchain, 'node_modules', name), join(dependencies, name));
  const isSignalTree = oldArm === 'v15' || oldArm === 'v16';
  identities[arm] = { implementation: oldArm, sourcePacket: oldPlanPath, sourcePlanSha256: config.baselinePlanSha256 };
  if (isSignalTree) for (const name of ['kernel', 'angular']) {
    let packageRoot, files, identity;
    if (arm.endsWith('-before')) {
      packageRoot = join(oldRoot, 'node_modules/@signal-tree', name); files = inventory(packageRoot);
      const expectedFiles = Object.fromEntries(Object.entries(original.inputs).filter(([path]) => path.startsWith(packageRoot + sep)).map(([path, expected]) => [path.slice(packageRoot.length + 1), expected]));
      assert(Object.keys(expectedFiles).length >= 10); assert.deepEqual(files, expectedFiles, 'Complete frozen package inventory');
      identity = original.artifacts[`${oldArm}-${name}`].sourceIdentity;
    } else {
      const selected = config.packages[arm][name];
      assert.equal(sha(selected.manifest), selected.manifestSha256); inputs[selected.manifest] = selected.manifestSha256;
      const manifest = read(selected.manifest); packageRoot = realpathSync(manifest.root); files = manifest.files;
      assert.deepEqual(inventory(packageRoot), files);
      assert.equal(sha(manifest.buildReceipt), manifest.buildReceiptSha256); inputs[manifest.buildReceipt] = manifest.buildReceiptSha256;
      const receipt = read(manifest.buildReceipt); assert.equal(receipt.exitCode, 0); assert.equal(receipt.sourceUnchanged, true);
      for (const [path, expected] of Object.entries(receipt.snapshots ?? {})) { assert.equal(sha(path), expected); inputs[path] = expected; }
      identity = { manifest: selected.manifest, manifestSha256: selected.manifestSha256, head: manifest.head, sourceSeal: manifest.sourceSeal, publication: 'unpublished optimization candidate' };
    }
    assert.equal(read(join(packageRoot, 'package.json')).name, '@signal-tree/' + name);
    const destination = join(dependencies, '@signal-tree', name), snapshot = join(out, 'snapshots', arm, name, 'package');
    for (const [relative, expected] of Object.entries(files)) { copy(join(packageRoot, relative), join(destination, relative), expected); copy(join(packageRoot, relative), join(snapshot, relative), expected); }
    const archive = join(out, 'archives', `${arm}-${name}.tgz`); mkdirSync(dirname(archive), { recursive: true });
    const packed = spawnSync('tar', ['-czf', archive, '-C', dirname(snapshot), 'package'], { encoding: 'utf8', env: { ...process.env, COPYFILE_DISABLE: '1' } }); assert.equal(packed.status, 0, packed.stderr);
    const listing = spawnSync('tar', ['-tzf', archive], { encoding: 'utf8' }); assert.equal(listing.status, 0, listing.stderr);
    assert.deepEqual(listing.stdout.trim().split('\n').filter(path => !path.endsWith('/')).sort(), Object.keys(files).map(path => 'package/' + path).sort());
    inputs[archive] = sha(archive);
    artifacts[`${arm}-${name}`] = { archive, integrity: 'sha512-' + createHash('sha512').update(readFileSync(archive)).digest('base64'), sourceIdentity: identity, unpublished: true };
    identities[arm][name] = identity;
  }
  if (isSignalTree) {
    assert.equal(read(join(dependencies, '@signal-tree/angular/package.json')).dependencies['@signal-tree/kernel'], read(join(dependencies, '@signal-tree/kernel/package.json')).version);
    edit(join(root, 'src/arms/selected-dispatch.ts'), text => {
      text = replaceOnce(text, '): Dispatch {', '): Dispatch & { contextRows(ids: readonly string[]): (DispatchJob | undefined)[] } {');
      return replaceOnce(text, "    kind: 'signaltree',\n", `    kind: 'signaltree',
    // Full keyed contexts use a value snapshot. Point UI readers stay granular.
    contextRows(ids: readonly string[]) {
      if (!active()) return ids.map(() => undefined);
      const values = accepted.$.jobs.asMap();
      return ids.map((id) => { const row = values.get(id); return row && projectJob(row); });
    },
`);
    });
  }
  if (!isSignalTree) {
    const selected = peerDerivation.derivations[arm];
    const path = join(root, 'src/arms/selected-dispatch.ts');
    assert.equal(sha(path), peerConfig.arms[arm].baseSha256, 'Copied peer base must match reviewed source');
    edit(path, () => readFileSync(selected.overlay, 'utf8'));
    assert.equal(sha(path), peerConfig.arms[arm].overlaySha256, 'Exact reviewed peer overlay');
  }
  edit(join(root, 'src/dispatch-main.ts'), text => replaceOnce(text, '    row: (id: string) => current().store().row(id),\n', `    row: (id: string) => current().store().row(id),
    contextRows: (ids: readonly string[]) => {
      const store = current().store() as Dispatch & { contextRows(ids: readonly string[]): (DispatchJob | undefined)[] };
      if (typeof store.contextRows !== 'function') throw new Error('Missing declared bulk context strategy');
      return store.contextRows(ids);
    },
    async contextAfterDestroy(ids: readonly string[]) {
      const store = current().store() as Dispatch & { contextRows(ids: readonly string[]): (DispatchJob | undefined)[] };
      if (typeof store.contextRows !== 'function') throw new Error('Missing declared bulk context strategy');
      await destroyApplication();
      return { point: ids.map((id) => store.row(id)), bulk: store.contextRows(ids) };
    },
`));
}
verify(); verifyExecution(config.execution);
writeFileSync(join(out, 'plan.json'), JSON.stringify({ ...original, arms, inputs, artifacts, toolchainDirectory: toolchain, createdUTC: new Date().toISOString(), phase: 'Unbuilt optimization comparison; no conformance or measurement claim', runtimeRefresh: { identities }, optimizationComparison: { schema: 1, baselinePlanPath: oldPlanPath, baselinePlanSha256: config.baselinePlanSha256, derivations, peerBulkContext: peerConfig, contextStrategies, execution: config.execution, command: [process.execPath, ...process.argv.slice(1)], limits: 'All eight apps declare their verified bulk context strategy; SignalTree before/after pairs use the same asMap strategy. Peer strategy overlays are application changes, and historical point-peer results remain separate. Selected50 remains point reads. Full native guarantees remain a separate qualified workflow.' } }, null, 2) + '\n', { flag: 'wx' });
console.log(out);
