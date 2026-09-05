#!/usr/bin/env node
/**
 * Install the packed tarball into a throwaway project and TYPE-CHECK real
 * consumer code against it.
 *
 * `verify-tarball-consumer.mjs` proves Node's resolver can find every subpath.
 * That is a different question from "do the shipped types work", and the gap
 * between them is where the expensive failures live: a `.d.ts` that references
 * a package we do not publish, a type dropped from the barrel, an `exports` map
 * whose `types` condition is missing for a subpath. All of those resolve fine
 * at runtime and break every consumer at compile time.
 *
 * Checked under BOTH module resolutions, because they fail differently:
 *
 *   - `bundler`  — what an Angular CLI app uses. Forgiving about `exports`.
 *   - `node16`   — strict. A subpath missing a `types` condition resolves under
 *                  `bundler` and hard-fails here, which is the single most
 *                  common way a published Angular library breaks TS consumers.
 *
 * The sample code below is deliberately the API the README and the agent skill
 * TEACH, not a minimal smoke — if the docs tell people to write it, it has to
 * compile against the tarball.
 *
 * Usage: node tools/verify-consumer-typecheck.mjs
 *        (requires dist/packages/kernel — run the build first)
 */
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readdirSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { assertReleasePlan } from '../scripts/release-plan.mjs';

const ROOT = process.cwd();
const PACKAGE_NAMES = assertReleasePlan(ROOT);
const suppliedTarballs = process.argv
  .filter((arg) => arg.startsWith('--tarball='))
  .map((arg) => resolve(ROOT, arg.slice('--tarball='.length)));

if (
  suppliedTarballs.length === 0 &&
  PACKAGE_NAMES.some((name) => !existsSync(join(ROOT, 'dist/packages', name)))
) {
  console.error(
    '❌ publishable package dist folders not found — run the build first.'
  );
  process.exit(1);
}

const work = mkdtempSync(join(tmpdir(), 'st-consumer-tsc-'));
console.log(
  '📦 Packing SignalTree packages and type-checking a real consumer\n'
);

const tarballPaths = [];
if (suppliedTarballs.length > 0) {
  for (const tarballPath of suppliedTarballs) {
    if (!existsSync(tarballPath)) {
      console.error(`❌ supplied tarball does not exist: ${tarballPath}`);
      process.exit(1);
    }
    tarballPaths.push(tarballPath);
  }
  if (tarballPaths.length !== PACKAGE_NAMES.length) {
    console.error(
      `❌ expected ${PACKAGE_NAMES.length} supplied tarballs, got ${tarballPaths.length}.`
    );
    process.exit(1);
  }
} else {
  for (const name of PACKAGE_NAMES) {
    const before = new Set(readdirSync(work));
    execFileSync('npm', ['pack', '--pack-destination', work], {
      cwd: join(ROOT, 'dist/packages', name),
      stdio: 'pipe',
    });
    const tarball = readdirSync(work).find(
      (file) => file.endsWith('.tgz') && !before.has(file)
    );
    if (!tarball) {
      console.error(`❌ npm pack produced no tarball for ${name}.`);
      process.exit(1);
    }
    tarballPaths.push(join(work, tarball));
  }
}

// --- consumer project -------------------------------------------------------
const proj = join(work, 'consumer');
mkdirSync(join(proj, 'src'), { recursive: true });
writeFileSync(
  join(proj, 'package.json'),
  // `type: module` matters for the node16 arm: without it the consumer is CJS
  // and every ESM import reports TS1479, which says nothing about our package.
  JSON.stringify(
    { name: 'consumer', version: '1.0.0', private: true, type: 'module' },
    null,
    2
  )
);

/** The API the docs actually teach. */
const SAMPLE = `
import {
  signalTree,
  entityMap,
  leaf,
  restoration,
  batching,
  type ReadonlyLocation,
} from '@signal-tree/kernel';
import { createSignalTreeFactory } from '@signal-tree/kernel/adapter';
import {
  defineStore,
  entityMap as angularEntityMap,
  signalTree as angularSignalTree,
} from '@signal-tree/angular';
import type { Signal as AngularSignal, WritableSignal } from '@angular/core';
import { useSignalTree } from '@signal-tree/react';
import type { ComputedRef, Ref } from 'vue';
import { signalTree as vueSignalTree } from '@signal-tree/vue';

type User = { id: number; name: string; version: number };

// Enhancers are DECLARED, all of them, in one array. There is no .with() to
// chain and no order to get right -- the sample shows the only shape there is.
const tree = signalTree(
  {
    count: 0,
    user: { name: 'Ada', age: 36 },
    bounds: leaf({ min: 0, max: 10 }),
    callback: leaf((value: number) => value),
    users: entityMap<User, number>({ selectId: (u: User) => u.id })
      .computed('names', (all) => all.map((user) => user.name)),
  },
  { enhancers: [restoration(), batching()] }
);

// Reads
const n: number = tree.$.count();
const whole: { count: number } = tree.$() as { count: number };
const rows: User[] = tree.$.users.all();
const names: ReadonlyLocation<string[]> = tree.$.users.names;
const currentNames: string[] = names.peek();
const unsubscribeNames = names.subscribe(() => undefined);
unsubscribeNames();

// Neutral kernel locations use callable read/replace/derive grammar.
tree.$.count(5);
tree.$.count((count: number) => count + 1);
tree.$.bounds({ min: 1, max: 9 });
tree.$.callback(leaf((value: number) => value + 1));

// Branch + root state locations ARE callable
tree.$.user({ name: 'Grace', age: 36 });
tree.$((current) => ({ ...current, count: 9 }));

// Marker APIs
tree.$.users.addOne({ id: 1, name: 'a', version: 1 });
tree.$.users.updateOne(1, { name: 'b' });

// Angular leaves and readonly projections use native Angular signal types while
// EntityMap methods and kernel semantic authority remain intact.
const angularTree = angularSignalTree({
  count: 0,
  users: angularEntityMap<User, number>({ selectId: (u: User) => u.id }),
});
const angularCount: WritableSignal<number> = angularTree.$.count;
const angularUsers: AngularSignal<User[]> = angularTree.$.users.all;
angularCount.set(1);
angularTree.$.users.setAll([]);

// Vue leaves and derived values use native Ref contracts over kernel truth.
const vueTree = vueSignalTree(
  { count: 1 },
  { derived: ($) => ({ doubled: () => $.count.value * 2 }) }
);
const vueCount: Ref<number> = vueTree.$.count;
const vueDoubled: ComputedRef<number> = vueTree.$.doubled;
vueCount.value = 2;

// Enhancer methods
tree.undo();
tree.redo();
tree.batch(() => tree.$.count(0));

export const _used = [n, whole, rows, names, currentNames, angularCount, angularUsers, vueCount, vueDoubled, createSignalTreeFactory, defineStore, useSignalTree];
`;
writeFileSync(join(proj, 'src', 'main.ts'), SAMPLE);

const FACADE_IDENTITY_PROBE = `
import * as kernel from '@signal-tree/kernel';
import * as angular from '@signal-tree/angular';
import * as react from '@signal-tree/react';
import * as vue from '@signal-tree/vue';
import { isSignal } from '@angular/core';
import { isRef } from 'vue';

const sharedRuntimeSymbols = [
  'entityMap',
  'link',
  'restoration',
  'undoable',
  'external',
  'asReadonly',
  'batching',
  'devTools',
  'transactions',
  'onTreeError',
  'SignalTreeRollbackError',
];

const facades = { angular, react, vue };
for (const packageName of ['angular', 'react', 'vue']) {
  const facade = facades[packageName];
  for (const symbol of sharedRuntimeSymbols) {
    if (facade[symbol] !== kernel[symbol]) {
      throw new Error(
        '@signal-tree/' + packageName + ' does not forward kernel ' + symbol + ' by identity.'
      );
    }
  }
}

if (react.signalTree !== kernel.signalTree) {
  throw new Error('@signal-tree/react does not forward kernel signalTree by identity.');
}
if (angular.signalTree === kernel.signalTree) {
  throw new Error('@signal-tree/angular silently fell back to neutral construction.');
}
if (vue.signalTree === kernel.signalTree) {
  throw new Error('@signal-tree/vue silently fell back to neutral construction.');
}
const angularTree = angular.signalTree({ count: 1 });
if (!isSignal(angularTree.$.count)) {
  throw new Error('@signal-tree/angular did not expose a native signal leaf.');
}
angularTree.$.count.set(2);
if (angularTree.$.count() !== 2) {
  throw new Error('@signal-tree/angular did not route a native signal write.');
}
angularTree.destroy();

const vueTree = vue.signalTree(
  { count: 1 },
  { derived: ($) => ({ doubled: () => $.count.value * 2 }) }
);
if (!isRef(vueTree.$.count) || !isRef(vueTree.$.doubled)) {
  throw new Error('@signal-tree/vue did not expose native ref leaves.');
}
vueTree.$.count.value = 2;
if (vueTree.$.doubled.value !== 4) {
  throw new Error('@signal-tree/vue did not route a native ref write.');
}
vueTree.destroy();
`;
writeFileSync(join(proj, 'src', 'facade-identity.mjs'), FACADE_IDENTITY_PROBE);

// --- install ----------------------------------------------------------------
console.log('  installing tarball...');
execFileSync(
  'npm',
  [
    'install',
    '--no-audit',
    '--no-fund',
    '--silent',
    ...tarballPaths,
    `@angular/core@${process.env['NG_VERSION'] || '^22.0.0'}`,
    'rxjs@^7.0.0',
    'react@^19.0.0',
    '@types/react@^19.0.0',
    'vue@^3.5.0',
    'typescript@^5.6.0',
  ],
  { cwd: proj, stdio: 'pipe' }
);

try {
  execFileSync('node', ['src/facade-identity.mjs'], { cwd: proj, stdio: 'pipe' });
  console.log('  ✅ framework facade runtime identities');
} catch (err) {
  const out = `${err.stdout || ''}${err.stderr || ''}`.trim();
  console.error(`  ❌ framework facade runtime identities\n       ${out}`);
  process.exit(1);
}

// --- typecheck under both resolutions ---------------------------------------
const RESOLUTIONS = [
  { name: 'bundler', module: 'esnext', moduleResolution: 'bundler' },
  { name: 'node16', module: 'node16', moduleResolution: 'node16' },
];

let failed = false;
for (const r of RESOLUTIONS) {
  writeFileSync(
    join(proj, `tsconfig.${r.name}.json`),
    JSON.stringify(
      {
        compilerOptions: {
          strict: true,
          noEmit: true,
          skipLibCheck: false,
          target: 'es2022',
          module: r.module,
          moduleResolution: r.moduleResolution,
          experimentalDecorators: true,
          lib: ['es2022', 'dom'],
          types: [],
        },
        include: ['src/**/*.ts'],
      },
      null,
      2
    )
  );
  try {
    execFileSync('npx', ['tsc', '-p', `tsconfig.${r.name}.json`], {
      cwd: proj,
      stdio: 'pipe',
    });
    console.log(`  ✅ moduleResolution: ${r.name}`);
  } catch (err) {
    failed = true;
    const out = `${err.stdout || ''}${err.stderr || ''}`;
    console.log(`  ❌ moduleResolution: ${r.name}`);
    out
      .split('\n')
      .filter((l) => l.includes('error TS'))
      .slice(0, 60)
      .forEach((l) => console.log(`       ${l.trim()}`));
  }
}

if (failed) {
  console.error(
    '\n❌ The published types do not compile for a consumer.\n' +
      '   This is invisible to `npm pack` and to require.resolve() — both pass on\n' +
      '   a package whose .d.ts files are broken.'
  );
  process.exit(1);
}
console.log(
  '\n✅ Consumer type-check passed under both bundler and node16 resolution.'
);
