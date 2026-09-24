#!/usr/bin/env node
/**
 * Mutation proof for the invocation-surface gate. A gate that cannot fail proves nothing,
 * and this one exists because the EXPORT baseline silently passed while
 * `transaction()` shipped unrecorded.
 *
 * Mutations target the emitted declaration owning each exported type/member,
 * following re-exports into shared chunks — this tests the gate, not the build.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, relative } from 'node:path';
import ts from 'typescript';

const ROOT = process.cwd();
const DTS = join(ROOT, 'dist/packages/kernel/dist/index.d.ts');

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
    owner: 'TransactionMethods',
    mutate: (s) =>
      s.replace(
        'interface TransactionMethods {',
        'interface TransactionMethods {\n    __fakeAdded(fn: () => void): void;'
      ),
    expect: (r) => r.failed && /ADDED.*__fakeAdded/s.test(r.out),
  },
  {
    name: '2 remove a method',
    owner: 'TransactionMethods',
    member: 'transact',
    mutate: (s) =>
      s.replace(/\n\s*transact\(fn: \(\) => void\): PendingTransaction;/, ''),
    expect: (r) => r.failed && /REMOVED.*transact\b/s.test(r.out),
  },
  {
    name: '3 rename a method -> one removal + one addition',
    owner: 'TransactionMethods',
    member: 'transact',
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
    owner: 'EntitySignal',
    member: 'clear',
    mutate: (s) => s.replace('clear(): void;', 'readonly clear: { (): void };'),
    expect: (r) =>
      r.failed &&
      /KIND CHANGED.*clear.*method -> callable-property/s.test(r.out),
  },
  {
    name: '5 callable property -> method',
    owner: 'EntitySignal',
    member: 'empty',
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
    owner: 'TransactionMethods',
    member: 'transact',
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
    owner: 'TransactionMethods',
    member: 'transact',
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
    owner: 'NodeAccessor',
    mutate: (s) =>
      s.replace(
        'interface NodeAccessor<T> {\n    /** Read: unwraps this node and everything under it. */\n    (): T;',
        'interface NodeAccessor<T> {'
      ),
    expect: (r) => r.failed && /SIGNATURE CHANGED.*NodeAccessor/s.test(r.out),
  },
  {
    name: '11 ADD an overload to a callable type',
    owner: 'NodeAccessor',
    mutate: (s) =>
      s.replace(
        'interface NodeAccessor<T> {',
        'interface NodeAccessor<T> {\n    (sneaky: string): void;'
      ),
    expect: (r) => r.failed && /SIGNATURE CHANGED.*NodeAccessor/s.test(r.out),
  },
  {
    name: '12 optional parameter becomes REQUIRED',
    owner: 'EntitySignal',
    member: 'addOne',
    mutate: (s) =>
      s.replace(
        'addOne(entity: E, opts?: AddOptions<E, K>): K;',
        'addOne(entity: E, opts: AddOptions<E, K>): K;'
      ),
    expect: (r) => r.failed && /SIGNATURE CHANGED.*addOne/s.test(r.out),
  },
  {
    name: '13 change an exported class CONSTRUCTOR shape',
    owner: 'SignalTreeRollbackError',
    mutate: (s) =>
      s.replace(
        'constructor(message?: string, options?: {',
        'constructor(code: number, message?: string, options?: {'
      ),
    expect: (r) =>
      r.failed &&
      /SIGNATURE CHANGED.*SignalTreeRollbackError\.new/s.test(r.out),
  },
];

// Resolve all targets before the first write. Never guess a generated basename
// or mutate the first matching text in an unrelated declaration.
const program = ts.createProgram([DTS], {
  noEmit: true,
  skipLibCheck: true,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  target: ts.ScriptTarget.ES2022,
});
const checker = program.getTypeChecker();
const entry = program.getSourceFile(DTS);
const moduleSymbol = entry && checker.getSymbolAtLocation(entry);
if (!moduleSymbol) throw new Error('Missing kernel declaration entry module');
const exported = new Map(
  checker
    .getExportsOfModule(moduleSymbol)
    .map((symbol) => [symbol.getName(), symbol])
);
const originals = new Map();
const targets = CASES.map((c) => {
  let declaration = entry;
  if (c.owner) {
    const symbol = exported.get(c.owner);
    const resolved =
      symbol &&
      (symbol.flags & ts.SymbolFlags.Alias
        ? checker.getAliasedSymbol(symbol)
        : symbol);
    const target =
      c.member && resolved
        ? checker.getDeclaredTypeOfSymbol(resolved).getProperty(c.member)
        : resolved;
    const declarations = target?.getDeclarations() ?? [];
    if (declarations.length !== 1)
      throw new Error(
        `${c.name}: expected exactly one declaration owner, found ${declarations.length}`
      );
    declaration = declarations[0];
  }
  const file = declaration.getSourceFile().fileName;
  const path = relative(join(ROOT, 'dist/packages/kernel'), file);
  if (isAbsolute(path) || path === '..' || path.startsWith('../'))
    throw new Error(
      `${c.name}: declaration owner is outside the kernel artifact`
    );
  if (!originals.has(file)) originals.set(file, readFileSync(file));
  const original = originals.get(file).toString('utf8');
  const before = original.slice(declaration.pos, declaration.end);
  const after = c.mutate(before);
  if (before === after)
    throw new Error(
      `${c.name}: MUTATION DID NOT APPLY (inert, proves nothing)`
    );
  return {
    file,
    original: originals.get(file),
    mutated:
      original.slice(0, declaration.pos) +
      after +
      original.slice(declaration.end),
  };
});

// This script is the existing api-callable-baseline:self gate. Keep allocation
// identity regressions mandatory, with their own count, before the 13 mutants.
execFileSync(
  process.execPath,
  [join(ROOT, 'tools/check-callable-inventory.mjs')],
  {
    cwd: ROOT,
    stdio: 'inherit',
  }
);

const clean = run();
if (clean.failed) {
  console.error(
    '❌ baseline is not clean before mutating; regenerate it first'
  );
  process.exit(1); // No mutation has happened yet.
}
let pass = 0;
let fail = 0;
console.log('\nCallable-gate mutation proof\n');
for (const [index, c] of CASES.entries()) {
  const target = targets[index];
  try {
    writeFileSync(target.file, target.mutated);
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
  } finally {
    // Restore exact bytes even if the mutant write or child checker throws.
    // Backups stay in memory, never inside the sealed package file set.
    writeFileSync(target.file, target.original);
  }
}
console.log(
  `\n${pass}/${CASES.length} mutations behaved correctly, ${fail} did not.\n`
);
process.exit(fail ? 1 : 0);
