#!/usr/bin/env node
/**
 * Exercise defineStore in a fresh Node process with no Angular JIT compiler.
 * Vitest's Angular setup loads the compiler and cannot detect this regression.
 * Bundle current source so this fast gate cannot silently test stale dist.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fixture = `
import assert from 'node:assert/strict';
import {
  createEnvironmentInjector, inject, InjectionToken,
  ɵINJECTOR_SCOPE as INJECTOR_SCOPE,
} from '@angular/core';
import { defineStore, signalTree } from './packages/angular/src/index.ts';

assert.equal(globalThis.ng?.ɵcompilerFacade, undefined);
const owners = [];
const owner = (providers, parent = null) => {
  const injector = createEnvironmentInjector(providers, parent);
  owners.push(injector);
  return injector;
};
const SEED = new InjectionToken('seed');
let localCreated = 0;
let lastLocal;
const Local = defineStore(() => {
  localCreated++;
  return lastLocal = signalTree({ count: inject(SEED) });
});
const Root = defineStore(() => signalTree({ scope: 'root' }), { providedIn: 'root' });
const Platform = defineStore(() => signalTree({ scope: 'platform' }), { providedIn: 'platform' });
const callable = Object.assign(() => 42, {
  released: 0,
  destroy() { this.released++; },
});
const Callable = defineStore(() => callable);
try {
  const platform = owner([{ provide: INJECTOR_SCOPE, useValue: 'platform' }]);
  const app = owner([{ provide: INJECTOR_SCOPE, useValue: 'root' }], platform);
  const secondApp = owner([{ provide: INJECTOR_SCOPE, useValue: 'root' }], platform);
  const local = owner([Local, Callable, { provide: SEED, useValue: 7 }], app);
  const child = owner([], local);
  const independent = owner([Local, { provide: SEED, useValue: 9 }], app);

  assert.equal(app.get(Local, null), null, 'local stores require an explicit provider');
  const tree = local.get(Local);
  assert.equal(tree, lastLocal, 'DI must return the factory result itself');
  assert.equal(local.get(Local), tree, 'local resolution is singleton');
  assert.equal(child.get(Local), tree, 'children borrow the providing owner');
  assert.equal(tree.$.count(), 7, 'factory runs in the injection context');
  tree.$.count.set(8);
  assert.equal(child.get(Local).$.count(), 8);
  const other = independent.get(Local);
  assert.notEqual(other, tree);
  assert.equal(other.$.count(), 9);
  assert.equal(localCreated, 2);
  assert.equal(local.get(Callable), callable);
  assert.equal(local.get(Callable)(), 42);

  const rootTree = app.get(Root);
  assert.equal(child.get(Root), rootTree);
  const secondRoot = secondApp.get(Root);
  assert.notEqual(secondRoot, rootTree, 'root scopes are separate applications');
  const platformTree = app.get(Platform);
  assert.equal(secondApp.get(Platform), platformTree);
  assert.equal(platform.get(Platform), platformTree);

  child.destroy();
  assert.equal(tree.destroyed(), false, 'a borrowing child cannot release the tree');
  local.destroy();
  assert.equal(tree.destroyed(), true);
  assert.equal(callable.released, 1, 'owned callable teardown preserves its receiver');
  assert.equal(other.destroyed(), false);
  independent.destroy();
  assert.equal(other.destroyed(), true);
  app.destroy();
  assert.equal(rootTree.destroyed(), true);
  assert.equal(secondRoot.destroyed(), false);
  assert.equal(platformTree.destroyed(), false);
  secondApp.destroy();
  assert.equal(secondRoot.destroyed(), true);
  platform.destroy();
  assert.equal(platformTree.destroyed(), true);
  assert.equal(globalThis.ng?.ɵcompilerFacade, undefined);
} finally {
  for (const injector of owners.reverse()) {
    if (!injector.destroyed) injector.destroy();
  }
}
console.log('Compiler-free defineStore: local/root/platform DI, identity, injection context and owner teardown passed.');
`;

const bundle = await build({
  stdin: {
    contents: fixture,
    resolveDir: root,
    sourcefile: 'angular-store-runtime.mjs',
  },
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false,
  metafile: true,
});
assert.ok(
  Object.keys(bundle.metafile.inputs).every(
    (path) =>
      !/@angular[\\/]compiler(?:[\\/.-]|$)|@angular[\\/]core[\\/]testing/.test(
        path
      )
  ),
  'The regression fixture must not load Angular compiler or TestBed'
);
const result = spawnSync(process.execPath, ['--input-type=module'], {
  cwd: root,
  input: bundle.outputFiles[0].text,
  encoding: 'utf8',
  env: { ...process.env, NODE_OPTIONS: '' },
});
if (result.error) throw result.error;
process.stdout.write(result.stdout);
process.stderr.write(result.stderr);
assert.equal(result.status, 0, 'Compiler-free Angular store runtime failed');
