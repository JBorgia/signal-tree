#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, openSync, closeSync, readdirSync, realpathSync, symlinkSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { admitPacket, assertNewOutput, here, inventory, lines, read, save, sha, sourceBindings, verify } from './context-strategy-common.mjs';
import { verifyExecution } from './context-strategy-execution.mjs';

const [mode, inputArg, outputArg] = process.argv.slice(2);
assert(['prepare', 'build'].includes(mode) && inputArg && outputArg);
const input = resolve(inputArg), out = resolve(outputArg); assertNewOutput(out);
const builder = resolve(here, '../application-lab/lab.mjs'), checker = resolve(here, '../application-lab/dispatch-check.mjs');
if (mode === 'prepare') {
  const config = read(input), baseline = realpathSync(config.baselinePacket), originalPlanPath = join(baseline, 'plan.json');
  const oldBuildPath = join(baseline, 'dispatch-build.json'), oldCheckPath = join(baseline, 'dispatch-conformance/results.json');
  for (const [path, expected] of [[originalPlanPath, config.planSha256], [oldBuildPath, config.buildSha256], [oldCheckPath, config.conformanceSha256]]) assert.equal(sha(path), expected);
  const oldPlan = read(originalPlanPath), oldBuild = read(oldBuildPath), oldCheck = read(oldCheckPath);
  assert.equal(oldBuild.planSha256, config.planSha256); assert.equal(oldCheck.planSha256, config.planSha256); assert.equal(oldCheck.buildSha256, config.buildSha256);
  assert(oldCheck.results.length && oldCheck.results.every(value => value.passed));
  const inputs = { [input]: sha(input), [originalPlanPath]: sha(originalPlanPath), [oldBuildPath]: sha(oldBuildPath), [oldCheckPath]: sha(oldCheckPath), [builder]: sha(builder), [checker]: sha(checker), ...sourceBindings() };
  const toolchain = realpathSync(oldPlan.toolchainDirectory);
  assert.equal(toolchain, config.execution.toolchainDirectory);
  verifyExecution(config.execution);
  for (const name of ['package.json', 'package-lock.json']) { const path = join(toolchain, name); assert.equal(sha(path), config.toolchain[name]); inputs[path] = sha(path); }
  const packages = {}, runtimeIdentities = {};
  for (const arm of lines) {
    assert(oldPlan.arms.includes(arm)); assert(oldBuild.arms[arm]);
    for (const [path, expected] of Object.entries({ ...oldBuild.arms[arm].dependencies, ...oldBuild.arms[arm].served })) { assert.equal(sha(path), expected, `Current baseline input drift: ${path}`); inputs[path] = expected; }
    packages[arm] = {};
    for (const name of ['kernel', 'angular']) {
      const root = join(baseline, arm, 'node_modules/@signal-tree', name), actual = inventory(root);
      assert.equal(read(join(root, 'package.json')).version, config.versions[arm]);
      for (const [relative, expected] of Object.entries(actual)) assert.equal(oldPlan.inputs[join(root, relative)], expected, 'Unbound installed package payload');
      assert.deepEqual(actual, config.packages[arm][name], 'Installed payload differs from frozen experiment configuration');
      packages[arm][name] = actual;
      assert.deepEqual(oldPlan.artifacts[`${arm}-${name}`].sourceIdentity, config.identities[arm][name], 'Wrong runtime/facade artifact identity');
    }
    runtimeIdentities[arm] = config.identities[arm];
  }
  verify(inputs); mkdirSync(out, { recursive: true });
  const copy = (from, to, expected) => { assert.equal(sha(from), expected); mkdirSync(dirname(to), { recursive: true }); copyFileSync(from, to); assert.equal(sha(to), expected); inputs[from] = expected; inputs[to] = expected; };
  for (const arm of lines) {
    const prefix = join(baseline, arm) + sep; let copied = 0;
    for (const [path, expected] of Object.entries(oldPlan.inputs)) if (path.startsWith(prefix)) {
      const relative = path.slice(prefix.length);
      if (relative.startsWith('dist/') || relative.startsWith('node_modules/') && !relative.startsWith('node_modules/@signal-tree/')) continue;
      copy(path, join(out, arm, relative), expected); copied++;
    }
    assert(copied > 20, 'Incomplete application copy');
    for (const relative of ['src/dispatch-main.ts', 'src/dispatch-model.ts', 'src/dispatch-backend.ts', 'src/dispatch-arm.ts', 'src/arms/selected-dispatch.ts', 'angular.json', 'tsconfig.json', 'package.json']) assert(inputs[join(out, arm, relative)], `Missing app file ${relative}`);
    const dependencies = join(out, arm, 'node_modules'); mkdirSync(dependencies, { recursive: true });
    for (const name of readdirSync(join(toolchain, 'node_modules'))) if (name !== '@signal-tree') symlinkSync(join(toolchain, 'node_modules', name), join(dependencies, name));
    for (const [name, expected] of Object.entries(packages[arm])) assert.deepEqual(inventory(join(dependencies, '@signal-tree', name)), expected);
  }
  const overlay = join(out, 'overlay-source');
  const generationCommand = [process.execPath, join(here, 'context-strategy-source.mjs'), baseline, config.planSha256, overlay];
  const generated = spawnSync(generationCommand[0], generationCommand.slice(1), { encoding: 'utf8' });
  save(join(out, 'source-generation.json'), { command: generationCommand, status: generated.status, stdout: generated.stdout, stderr: generated.stderr }); assert.equal(generated.status, 0, generated.stderr);
  const overlayPath = join(overlay, 'source-overlay.json'), receipt = read(overlayPath); inputs[overlayPath] = sha(overlayPath);
  assert.equal(receipt.baselinePlanSha256, config.planSha256);
  for (const replacement of receipt.replacements) {
    assert(lines.includes(replacement.arm)); assert(['src/dispatch-main.ts', 'src/arms/selected-dispatch.ts'].includes(replacement.relative));
    const destination = join(out, replacement.arm, replacement.relative); assert.equal(inputs[destination], replacement.beforeSha256); assert.equal(sha(destination), replacement.beforeSha256);
    copy(replacement.source, destination, replacement.afterSha256);
  }
  assert.equal(receipt.replacements.length, 4);
  verify(inputs);
  verifyExecution(config.execution);
  save(join(out, 'plan.json'), { arms: lines, createdUTC: new Date().toISOString(), toolchainDirectory: toolchain, inputs, phase: 'Unbuilt context strategy application; no conformance/performance claim', contextStrategy: { schema: 1, baselinePlanPath: originalPlanPath, baselinePlanSha256: config.planSha256, toolSources: sourceBindings(), builder, checker, packages, runtimeIdentities, execution: config.execution, replacements: receipt.replacements, provenanceScope: 'Original plan is historical provenance. Every copied app/package and actual previous build dependency/served payload is checked live; no archived executable substitution.' } });
  console.log(out);
} else {
  const packet = input, plan = read(join(packet, 'plan.json')); verify(plan.inputs);
  verifyExecution(plan.contextStrategy.execution);
  assert.deepEqual(plan.contextStrategy.toolSources, sourceBindings());
  assert.equal(plan.contextStrategy.builder, builder); assert.equal(plan.contextStrategy.checker, checker);
  assertNewOutput(join(packet, 'dispatch-build.json')); assertNewOutput(join(packet, 'dispatch-conformance'));
  mkdirSync(out, { recursive: true }); const commands = [];
  for (const [name, args] of [['build', [builder, 'build-dispatch', packet]], ['conformance', [checker, packet]]]) {
    const log = join(out, name + '.log'), fd = openSync(log, 'wx'), startedUTC = new Date().toISOString();
    const result = spawnSync(process.execPath, args, { cwd: dirname(here), env: { ...process.env, NG_CLI_ANALYTICS: 'false' }, stdio: ['ignore', fd, fd] }); closeSync(fd);
    commands.push({ name, command: [process.execPath, ...args], startedUTC, endedUTC: new Date().toISOString(), status: result.status, error: result.error?.message, log, logSha256: sha(log) });
    save(join(out, name + '-receipt.json'), commands.at(-1));
    if (result.status !== 0) { save(join(out, 'results.json'), { passed: false, commands }); process.exit(1); }
  }
  const admitted = admitPacket(packet); save(join(out, 'results.json'), { passed: true, commands, identity: admitted.identity });
}
