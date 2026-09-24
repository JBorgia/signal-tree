#!/usr/bin/env node
// Isolated emitted-declaration fixtures. No build, registry or workspace dist writes.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
let failed = 0;
function check(name, body) {
  const root = mkdtempSync(join(tmpdir(), 'callable-inventory-'));
  try {
    mkdirSync(join(root, 'tools'));
    mkdirSync(join(root, 'node_modules'));
    mkdirSync(join(root, 'dist/packages/kernel/dist'), { recursive: true });
    symlinkSync(
      dirname(require.resolve('typescript/package.json')),
      join(root, 'node_modules/typescript')
    );
    copyFileSync(
      new URL('api-callable-inventory.mjs', import.meta.url),
      join(root, 'tools/api-callable-inventory.mjs')
    );
    const write = (text, file = 'index.d.ts') =>
      writeFileSync(join(root, 'dist/packages/kernel/dist', file), text);
    const run = (expected = 0, compare = false) => {
      const result = spawnSync(
        process.execPath,
        ['tools/api-callable-inventory.mjs', ...(compare ? ['--check'] : [])],
        {
          cwd: root,
          encoding: 'utf8',
          env: { PATH: process.env.PATH },
        }
      );
      assert.equal(result.status, expected, result.stdout + result.stderr);
      return result.stdout + result.stderr;
    };
    const rows = () =>
      JSON.parse(
        readFileSync(join(root, 'tools/api-callable-baseline.json'), 'utf8')
      ).rows;
    body({ write, run, rows });
    console.log(`✓ ${name}`);
  } catch (error) {
    failed++;
    console.error(`✗ ${name}: ${error.message}`);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}
check(
  'declaration allocation order preserves the same public symbol contract',
  ({ write, run, rows }) => {
    const padding = 'export interface Padding { readonly [noise]: number }';
    const contract =
      'export interface Contract { [Symbol.iterator](): Iterator<string> }';
    write(`declare const noise: unique symbol;\n${padding}\n${contract}`);
    run();
    const before = rows();
    write(`declare const noise: unique symbol;\n${contract}\n${padding}`);
    run(0, true);
    run();
    assert.deepEqual(rows(), before);
    assert.equal(before[0].id, 'kernel:Contract[Symbol.iterator]');
  }
);
check(
  'well-known symbol signature and kind changes remain visible',
  ({ write, run }) => {
    write(
      'export interface Contract { [Symbol.iterator](): Iterator<string> }'
    );
    run();
    write(
      'export interface Contract { [Symbol.iterator](): Iterator<number> }'
    );
    assert.match(
      run(1, true),
      /SIGNATURE CHANGED.*Contract\[Symbol\.iterator\]/
    );
    write(
      'export interface Contract { readonly [Symbol.iterator]: () => Iterator<string> }'
    );
    assert.match(run(1, true), /KIND CHANGED.*method -> callable-property/);
  }
);
check(
  'same-description unique symbols and a shadowed Symbol remain distinct',
  ({ write, run, rows }) => {
    for (const file of ['left.d.ts', 'right.d.ts'])
      write('export declare const iterator: unique symbol;', file);
    write(`import { iterator as left } from './left.js';
    import { iterator as right } from './right.js';
    declare const Symbol: { readonly iterator: unique symbol };
    export interface Contract { [left](): void; [right](): void; [Symbol.iterator](): void; }`);
    run();
    assert.equal(rows().length, 3);
    assert.equal(new Set(rows().map((row) => row.id)).size, 3);
    assert.ok(rows().every((row) => /^__@iterator@\d+$/.test(row.name)));
  }
);
check(
  'well-known symbol identity cannot collide with a literal property',
  ({ write, run, rows }) => {
    write(`declare const WellKnown: SymbolConstructor;
    export interface Contract { [WellKnown.iterator](): void; '[Symbol.iterator]'(): void; }`);
    run();
    assert.deepEqual(
      rows()
        .filter((row) => row.owner === 'Contract')
        .map((row) => row.id)
        .sort(),
      [
        'kernel:Contract.[Symbol.iterator]',
        'kernel:Contract[Symbol.iterator]',
      ].sort()
    );
  }
);
console.log(
  `Callable inventory controls: ${4 - failed} passed, ${failed} failed.`
);
if (failed) process.exitCode = 1;
