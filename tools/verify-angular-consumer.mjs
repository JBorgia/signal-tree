#!/usr/bin/env node
/**
 * Install packed SignalTree packages into a throwaway Angular-flavoured
 * TypeScript project and type-check representative Angular imports.
 *
 * This is intentionally smaller than creating a full Angular CLI app: Gate C
 * needs to prove the shipped tarballs, exports and peer graph type-check for an
 * Angular consumer. Runtime/browser execution belongs to Gate D.
 *
 * Usage: node tools/verify-angular-consumer.mjs
 *        (requires dist/packages/kernel — run the build first)
 */
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROOT = process.cwd();
const DIST = join(ROOT, 'dist/packages');
const PACKAGES = ['core'];
const ANGULAR_VERSION = process.env['NG_VERSION'] || '^22.0.0';
const VERSION = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version;

for (const pkg of PACKAGES) {
  if (!existsSync(join(DIST, pkg, 'package.json'))) {
    console.error(`❌ dist/packages/${pkg} not found — run the build first.`);
    process.exit(1);
  }
}

const work = mkdtempSync(join(tmpdir(), 'st-angular-consumer-'));
const tgzDir = join(work, 'tgz');
mkdirSync(tgzDir, { recursive: true });

console.log('📦 Packing SignalTree packages for Angular consumer smoke\n');

execFileSync(
  'node',
  ['scripts/resolve-workspace-specs.mjs', VERSION, ...PACKAGES],
  { cwd: ROOT, stdio: 'pipe' }
);

const tarballs = [];
for (const pkg of PACKAGES) {
  execFileSync('npm', ['pack', '--pack-destination', tgzDir], {
    cwd: join(DIST, pkg),
    stdio: 'pipe',
  });
  const tarball = readdirSync(tgzDir)
    .filter((file) => file.endsWith('.tgz'))
    .find((file) => file.includes(`signaltree-${pkg}`));
  if (!tarball) {
    console.error(`❌ npm pack produced no ${pkg} tarball.`);
    process.exit(1);
  }
  tarballs.push(join(tgzDir, tarball));
}

const proj = join(work, 'consumer');
mkdirSync(join(proj, 'src'), { recursive: true });
writeFileSync(
  join(proj, 'package.json'),
  JSON.stringify(
    {
      name: 'st-angular-consumer',
      version: '0.0.0',
      private: true,
      type: 'module',
    },
    null,
    2
  )
);

writeFileSync(
  join(proj, 'src', 'main.ts'),
  `
import { Component, signal } from '@angular/core';
import { FormControl } from '@angular/forms';
import {
  batching,
  entityMap,
  signalTree,
  restoration,
  toWritableSignal,
} from '@signal-tree/kernel';

type User = { id: number; name: string };

const tree = signalTree({
  count: 0,
  users: entityMap<User, number>({ selectId: (user) => user.id }),
}, { enhancers: [restoration(), batching()] });

tree.$.users.addOne({ id: 1, name: 'Ada' });
tree.batch(() => tree.$.count.set(1));

// Forms are COMPOSED, not provided. The ng-forms package is deleted, so this
// fixture exercises the seam the project actually ships: an ordinary branch
// handed to Angular as a writable signal.
// (No backticks in this comment on purpose — it lives inside a template
// literal, and a backtick here silently ends the fixture source.)
const profile = signalTree({ email: '' });
const control = new FormControl(toWritableSignal(profile.$)().email);


@Component({
  standalone: true,
  template: '<input [formControl]="control" />',
  imports: [],
})
class SmokeComponent {
  readonly control = control;
  readonly tree = tree;
}

export const used = [SmokeComponent, profile, tree];
`
);

writeFileSync(
  join(proj, 'tsconfig.json'),
  JSON.stringify(
    {
      compilerOptions: {
        strict: true,
        noEmit: true,
        skipLibCheck: true,
        target: 'es2022',
        module: 'esnext',
        moduleResolution: 'bundler',
        experimentalDecorators: true,
        useDefineForClassFields: false,
        lib: ['es2022', 'dom'],
        types: [],
      },
      include: ['src/**/*.ts'],
    },
    null,
    2
  )
);

console.log(`  installing Angular ${ANGULAR_VERSION} + packed SignalTree tarballs...`);
try {
  execFileSync(
    'npm',
    [
      'install',
      '--no-audit',
      '--no-fund',
      ...tarballs,
      `@angular/core@${ANGULAR_VERSION}`,
      `@angular/common@${ANGULAR_VERSION}`,
      `@angular/forms@${ANGULAR_VERSION}`,
      'rxjs@^7.0.0',
      'tslib@^2.0.0',
      'zod@^3.0.0',
      'typescript@^5.6.0',
    ],
    { cwd: proj, stdio: 'pipe' }
  );
} catch (err) {
  console.error('❌ Angular consumer npm install failed:\n');
  console.error(`${err.stdout || ''}${err.stderr || ''}`.trim());
  process.exit(1);
}

try {
  execFileSync('npx', ['tsc', '-p', 'tsconfig.json'], {
    cwd: proj,
    stdio: 'pipe',
  });
} catch (err) {
  const out = `${err.stdout || ''}${err.stderr || ''}`;
  console.error('❌ Angular consumer typecheck failed:\n');
  out
    .split('\n')
    .filter((line) => line.includes('error TS'))
    .slice(0, 80)
    .forEach((line) => console.error(`  ${line.trim()}`));
  process.exit(1);
}

console.log('✅ Angular consumer smoke type-check passed.');
