#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { arms, fresh, inventory, nodeIdentity, read, save, sha, sourceNames, verify } from './common.mjs';

const [configArg, outputArg] = process.argv.slice(2);
assert(configArg && outputArg, 'prepare.mjs CONFIG NEW_PACKET');
assert.equal(process.version, 'v24.15.0');
assert(!process.env.NODE_OPTIONS && !process.env.ESBUILD_BINARY_PATH);
const runner = fileURLToPath(import.meta.url), here = dirname(runner), repository = resolve(here, '../../..');
const configPath = resolve(configArg), config = read(configPath);
assert.equal(config.kind, 'native-final-config-v1');
const planPath = resolve(config.artifactPlan), buildPath = resolve(config.dispatchBuild);
assert.equal(sha(planPath), config.artifactPlanSha256); assert.equal(sha(buildPath), config.dispatchBuildSha256);
const plan = read(planPath), build = read(buildPath);
assert.equal(build.planSha256, config.artifactPlanSha256);
assert(plan.arms.includes('v16-before') && plan.arms.includes('v16'));
assert.equal(plan.optimizationComparison.contextStrategies['v16-before'], plan.optimizationComparison.contextStrategies.v16);
const bindings = { ...plan.inputs, [configPath]: sha(configPath), [planPath]: sha(planPath), [buildPath]: sha(buildPath) };
for (const arm of ['v16-before', 'v16']) {
  assert(build.arms[arm]); Object.assign(bindings, build.arms[arm].dependencies, build.arms[arm].served);
}
verify(bindings); // Full shared metadata is parent-only, never arm-dependent child prehistory.
const out = fresh(outputArg, [repository, dirname(planPath), configPath, ...Object.keys(bindings)]);
const tools = {}, toolRoot = join(out, 'tools'); mkdirSync(toolRoot);
for (const name of sourceNames) {
  const original = join(here, name), copy = join(toolRoot, name);
  copyFileSync(original, copy); bindings[original] = sha(original); tools[copy] = sha(copy); bindings[copy] = sha(copy);
}
const old = {
  public: join(repository, 'tools/agent-collaboration-lab/public-workflow.mjs'),
  http: join(repository, 'tools/agent-collaboration-lab/http-browser/run.mjs'),
  coordination: join(repository, 'tools/application-lab/coordination-aging.mjs'),
};
for (const root of [join(repository, 'tools/agent-collaboration-lab'), join(repository, 'tools/experiments/multi-actor-operations')])
  for (const [relative, expected] of Object.entries(inventory(root))) bindings[join(root, relative)] = expected;
for (const path of [old.coordination, join(repository, 'tools/application-lab/pending-lifetime-costs.mjs'), join(repository, 'tools/application-lab/bulk-rollback-aging.mjs')]) bindings[path] = sha(path);
// Preserve the existing application helper as a bound reference; do not mutate it.
const sharedExecutionHelper = join(repository, 'tools/optimization-sweep/context-strategy-execution.mjs');
bindings[sharedExecutionHelper] = sha(sharedExecutionHelper);
const executionHelper = join(toolRoot, 'native-execution.mjs');
const { freezeExecution } = await import(pathToFileURL(executionHelper));
const browserExecution = freezeExecution(repository);
const require = createRequire(join(repository, 'package.json'));
// The old installed workflow is intentionally reused at its original path.
// Bind the installed compiler/test dependency closure it resolves there, including
// Babel selected from compiler-cli's own resolver, not just the app toolchain.
function packageRoot(name, resolver) {
  try { return dirname(realpathSync(resolver.resolve(name + '/package.json'))); }
  catch (manifestError) {
    // Some exports maps hide package.json. Locate its actual entry's package;
    // never substitute a different version from the workspace resolver.
    try {
      let at = dirname(realpathSync(resolver.resolve(name)));
      while (dirname(at) !== at) {
        const path = join(at, 'package.json');
        if (existsSync(path) && read(path).name === name) return at;
        at = dirname(at);
      }
    } catch { /* Packages without a root entry can still expose only types. */ }
    for (const directory of resolver.resolve.paths(name) ?? []) {
      const path = join(directory, name, 'package.json');
      if (existsSync(path) && read(path).name === name) return dirname(realpathSync(path));
    }
    throw manifestError;
  }
}
const queue = ['@playwright/test', '@angular/core', '@angular/compiler', '@angular/compiler-cli', '@angular/common', '@angular/platform-browser', 'typescript', 'tslib', 'rxjs', 'esbuild']
  .map(name => packageRoot(name, require));
const compilerRequire = createRequire(join(packageRoot('@angular/compiler-cli', require), 'package.json'));
const compilerBabelRoot = packageRoot('@babel/core', compilerRequire); queue.push(compilerBabelRoot);
const buildDependencies = {};
while (queue.length) {
  const root = queue.shift(); if (buildDependencies[root]) continue;
  const pkg = read(join(root, 'package.json')), files = inventory(root), edges = [], unavailableOptional = [];
  buildDependencies[root] = { name: pkg.name, version: pkg.version, files, edges, unavailableOptional };
  for (const [relative, expected] of Object.entries(files)) bindings[join(root, relative)] = expected;
  const resolver = createRequire(join(root, 'package.json'));
  for (const name of new Set([...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.optionalDependencies ?? {}), ...Object.keys(pkg.peerDependencies ?? {})])) {
    const optional = Object.hasOwn(pkg.optionalDependencies ?? {}, name) || pkg.peerDependenciesMeta?.[name]?.optional === true;
    try { const target = packageRoot(name, resolver); edges.push({ name, root: target }); queue.push(target); }
    catch (error) { assert(optional, `Unresolved required build dependency ${pkg.name} -> ${name}: ${String(error)}`); unavailableOptional.push({ name, error: String(error) }); }
  }
}
const esbuildPath = require.resolve('esbuild'), esbuild = require(esbuildPath), esbuildRequire = createRequire(esbuildPath);
for (const file of [join(repository, 'package.json'), join(repository, 'pnpm-lock.yaml'), esbuildPath,
  join(dirname(esbuildPath), '../package.json'), esbuildRequire.resolve(`@esbuild/${process.platform}-${process.arch}/bin/esbuild`)]) bindings[file] = sha(file);
const selected = {}, allPackages = {}, configs = {}, views = {};
for (const arm of arms) {
  const applicationArm = arm === 'before' ? 'v16-before' : 'v16';
  allPackages[arm] = {};
  for (const name of ['kernel', 'angular']) {
    const artifact = plan.artifacts[`${applicationArm}-${name}`]; assert(artifact?.sourceIdentity || artifact?.sourceCommit);
    assert.equal('sha512-' + createHash('sha512').update(readFileSync(artifact.archive)).digest('base64'), artifact.integrity);
    const installed = join(dirname(planPath), applicationArm, 'node_modules/@signal-tree', name);
    const files = inventory(installed);
    assert(Object.keys(files).length >= 10);
    for (const [relative, expected] of Object.entries(files)) assert.equal(plan.inputs[join(installed, relative)], expected, 'Complete admitted installed package');
    const archive = join(out, `${arm}-${name}.tgz`); copyFileSync(artifact.archive, archive);
    const extracted = join(out, 'packages', arm, name); mkdirSync(extracted, { recursive: true });
    const listing = spawnSync('tar', ['-tzf', archive], { encoding: 'utf8' });
    assert.equal(listing.status, 0, listing.stderr); assert.equal(listing.signal, null); assert(!listing.error);
    assert.deepEqual(listing.stdout.trim().split('\n').filter(path => !path.endsWith('/')).sort(), Object.keys(files).map(path => 'package/' + path).sort());
    const unpack = spawnSync('tar', ['-xzf', archive, '-C', extracted], { encoding: 'utf8' });
    assert.equal(unpack.status, 0, unpack.stderr); assert.equal(unpack.signal, null); assert(!unpack.error);
    const root = join(extracted, 'package'); assert.deepEqual(inventory(root), files);
    const pkg = read(join(root, 'package.json')); assert.equal(pkg.name, '@signal-tree/' + name);
    const item = { root, files, archive, archiveSha256: sha(archive), integrity: artifact.integrity, sourceIdentity: artifact.sourceCommit ?? artifact.sourceIdentity, sourceArchive: artifact.archive };
    allPackages[arm][name] = item; bindings[archive] = sha(archive);
    for (const [relative, expected] of Object.entries(files)) bindings[join(root, relative)] = expected;
  }
  const kernel = allPackages[arm].kernel, angular = allPackages[arm].angular;
  assert.equal(read(join(angular.root, 'package.json')).dependencies['@signal-tree/kernel'], read(join(kernel.root, 'package.json')).version);
  const exports = read(join(kernel.root, 'package.json')).exports;
  const entry = join(out, arm + '.entry.mjs'), bundle = join(out, arm + '.production.mjs');
  writeFileSync(entry, [
    `import {signalTree,entityMap,transactions,link} from ${JSON.stringify(resolve(kernel.root, exports['.'].import))};`,
    `import {transactionLifecycleReader} from ${JSON.stringify(resolve(kernel.root, exports['./internals'].import))};`,
    'export const create=()=>signalTree({rows:entityMap({selectId:r=>r.id})},{enhancers:[transactions()]});',
    'export const attach=(tree,sink)=>link(tree.$.rows,{set:sink});',
    'export const populate=(tree,rows)=>tree.$.rows.setAll(rows);',
    'export const read=tree=>tree.$.rows.all();',
    'export const pending=tree=>transactionLifecycleReader(tree).snapshot().pending.length;', '',
  ].join('\n'), { flag: 'wx' });
  const built = await esbuild.build({ entryPoints: [entry], outfile: bundle, bundle: true, minify: true, treeShaking: true,
    format: 'esm', platform: 'browser', target: 'es2022', define: { ngDevMode: 'false', 'process.env.NODE_ENV': '"production"' }, metafile: true, logLevel: 'silent' });
  const meta = join(out, arm + '.metafile.json'); save(meta, built.metafile);
  const emittedNativeFactory = Object.values(built.metafile.outputs).some(value => Object.entries(value.inputs).some(([path, info]) => path.endsWith('/experimental-publication/entity.js') && info.bytesInOutput > 0));
  assert.equal(emittedNativeFactory, true, 'Active native Link factory must be in production fixture');
  for (const path of Object.keys(built.metafile.inputs)) {
    const absolute = resolve(path); assert(absolute === entry || absolute.startsWith(kernel.root + sep), 'No source alias or mixed package'); bindings[absolute] = sha(absolute);
  }
  for (const path of [entry, bundle, meta]) bindings[path] = sha(path);
  selected[arm] = { kernel, bundle: { path: bundle, sha256: sha(bundle), metafile: meta, metafileSha256: sha(meta), emittedNativeFactory } };
  const view = join(out, 'views', arm); mkdirSync(view, { recursive: true });
  const artifacts = Object.fromEntries(['kernel', 'angular'].map(name => [`v16-${name}`, { archive: allPackages[arm][name].archive, integrity: allPackages[arm][name].integrity, sourceIdentity: allPackages[arm][name].sourceIdentity }]));
  const viewPlan = join(view, 'plan.json');
  save(viewPlan, { artifacts, inputs: {}, nativeFinalView: { originalPlan: planPath, originalPlanSha256: sha(planPath), applicationArm, purpose: 'Exact artifact-name adapter only; no runtime or workflow source modification' } });
  configs[arm] = join(view, 'public-config.json');
  save(configs[arm], { artifactPlan: viewPlan, artifactPlanSha256: sha(viewPlan), sourceIdentity: kernel.sourceIdentity,
    artifacts: { kernel: artifacts['v16-kernel'], angular: artifacts['v16-angular'] }, limits: 'Unchanged installed public workflow; functional verification only. Native-final parent admits both archives and original full plan.' });
  bindings[viewPlan] = sha(viewPlan); bindings[configs[arm]] = sha(configs[arm]); views[arm] = view;
}
const executionPath = join(out, 'execution.json');
save(executionPath, { kind: 'native-final-execution-v1', node: nodeIdentity(), tools, arms: selected });
bindings[executionPath] = sha(executionPath); verify(bindings);
save(join(out, 'packet.json'), { kind: 'native-final-packet-v1', createdUTC: new Date().toISOString(), command: process.argv,
  originalPlan: { path: planPath, sha256: sha(planPath), dispatchBuild: buildPath, dispatchBuildSha256: sha(buildPath) },
  bindings, execution: { path: executionPath, sha256: sha(executionPath) }, runner: join(toolRoot, 'run.mjs'), old, configs, views, allPackages,
  browserExecution, executionHelper, sharedExecutionHelper, buildDependencies, compilerBabelRoot, bundler: { version: esbuild.version, path: esbuildPath, sha256: sha(esbuildPath) }, protected: [repository, dirname(planPath), configPath],
  limits: 'Final native guarantees compared only with frozen C1, not other libraries. CPU and heap processes separate; browser and coordination cases are functional. Source identities are joined to original exact package plan, not inferred from labels.' });
console.log(join(out, 'packet.json'));
