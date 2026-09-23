#!/usr/bin/env node
/**
 * Mutation proof for the callable gate. A gate that cannot fail proves nothing,
 * and this one exists because the EXPORT baseline silently passed while
 * `transaction()` shipped unrecorded.
 *
 * Mutations are applied to the emitted `index.d.ts`, which is exactly the input
 * the gate reads — so this tests the gate, not the build.
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const DTS = join(ROOT, 'dist/packages/kernel/dist/index.d.ts');
const BACKUP = `${DTS}.selftest-backup`;

const run = () => {
  try {
    execFileSync('node', ['tools/api-callable-inventory.mjs', '--check'], {
      encoding: 'utf8',
      stdio: 'pipe',
    });
    return { failed: false, out: '' };
  } catch (e) {
    return { failed: true, out: `${e.stdout ?? ''}${e.stderr ?? ''}` };
  }
};

const CASES = [
  {
    name: '1 add method to an ALREADY-EXPORTED interface',
    mutate: (s) =>
      s.replace(
        'interface TransactionMethods {',
        'interface TransactionMethods {\n    __fakeAdded(fn: () => void): void;'
      ),
    expect: (r) => r.failed && /ADDED.*__fakeAdded/s.test(r.out),
  },
  {
    name: '2 remove a method',
    mutate: (s) =>
      s.replace(/\n\s*transact\(fn: \(\) => void\): PendingTransaction;/, ''),
    expect: (r) => r.failed && /REMOVED.*transact\b/s.test(r.out),
  },
  {
    name: '3 rename a method -> one removal + one addition',
    mutate: (s) =>
      s.replace(
        'transact(fn: () => void): PendingTransaction;',
        'transactRenamed(fn: () => void): PendingTransaction;'
      ),
    expect: (r) =>
      r.failed &&
      /REMOVED.*TransactionMethods\.transact\b/s.test(r.out) &&
      /ADDED.*transactRenamed/s.test(r.out),
  },
  {
    name: '4 method -> callable property',
    mutate: (s) => s.replace('clear(): void;', 'readonly clear: { (): void };'),
    expect: (r) =>
      r.failed &&
      /KIND CHANGED.*clear.*method -> callable-property/s.test(r.out),
  },
  {
    name: '5 callable property -> method',
    mutate: (s) =>
      s.replace(/readonly empty: ReadonlyOf<boolean, C>;/, 'empty(): boolean;'),
    expect: (r) =>
      r.failed &&
      /KIND CHANGED.*empty.*callable-property -> method/s.test(r.out),
  },
  {
    name: '6 add an exported top-level function',
    mutate: (s) =>
      `${s}\ndeclare function __fakeTopLevel(): void;\nexport { __fakeTopLevel };\n`,
    expect: (r) =>
      r.failed && /ADDED.*root\.__fakeTopLevel.*function/s.test(r.out),
  },
  {
    name: '7 add a method to a NON-exported interface (must be ignored)',
    mutate: (s) => `${s}\ninterface __NotExported { __privateThing(): void }\n`,
    expect: (r) => !r.failed,
  },
  {
    name: '8 change a method PARAMETER type',
    mutate: (s) =>
      s.replace(
        'transact(fn: () => void): PendingTransaction;',
        'transact(fn: (x: number) => void): PendingTransaction;'
      ),
    expect: (r) =>
      r.failed &&
      /SIGNATURE CHANGED.*TransactionMethods\.transact/s.test(r.out),
  },
  {
    name: '9 change a method RETURN type',
    mutate: (s) =>
      s.replace(
        'transact(fn: () => void): PendingTransaction;',
        'transact(fn: () => void): void;'
      ),
    expect: (r) =>
      r.failed &&
      /SIGNATURE CHANGED.*TransactionMethods\.transact/s.test(r.out),
  },
  {
    name: '10 REMOVE an overload from a callable type',
    mutate: (s) =>
      s.replace(
        'interface NodeAccessor<T> {\n    /** Read: unwraps this node and everything under it. */\n    (): T;',
        'interface NodeAccessor<T> {'
      ),
    expect: (r) => r.failed && /SIGNATURE CHANGED.*NodeAccessor/s.test(r.out),
  },
  {
    name: '11 ADD an overload to a callable type',
    mutate: (s) =>
      s.replace(
        'interface NodeAccessor<T> {',
        'interface NodeAccessor<T> {\n    (sneaky: string): void;'
      ),
    expect: (r) => r.failed && /SIGNATURE CHANGED.*NodeAccessor/s.test(r.out),
  },
  {
    name: '12 optional parameter becomes REQUIRED',
    mutate: (s) =>
      s.replace(
        'addOne(entity: E, opts?: AddOptions<E, K>): K;',
        'addOne(entity: E, opts: AddOptions<E, K>): K;'
      ),
    expect: (r) => r.failed && /SIGNATURE CHANGED.*addOne/s.test(r.out),
  },
];

copyFileSync(DTS, BACKUP);
const original = readFileSync(DTS, 'utf8');
let pass = 0;
let fail = 0;
try {
  const clean = run();
  if (clean.failed) {
    console.error(
      '❌ baseline is not clean before mutating; regenerate it first'
    );
    process.exit(1);
  }
  console.log('\nCallable-gate mutation proof\n');
  for (const c of CASES) {
    const mutated = c.mutate(original);
    if (mutated === original) {
      console.log(
        `  ✗ ${c.name}  — MUTATION DID NOT APPLY (inert, proves nothing)`
      );
      fail++;
      continue;
    }
    writeFileSync(DTS, mutated);
    const r = run();
    if (c.expect(r)) {
      console.log(`  ✓ ${c.name}`);
      pass++;
    } else {
      console.log(
        `  ✗ ${c.name}  — gate ${
          r.failed ? 'failed but not as required' : 'DID NOT FAIL'
        }`
      );
      fail++;
    }
    writeFileSync(DTS, original);
  }
} finally {
  copyFileSync(BACKUP, DTS);
}
console.log(
  `\n${pass}/${CASES.length} mutations behaved correctly, ${fail} did not.\n`
);
process.exit(fail ? 1 : 0);
