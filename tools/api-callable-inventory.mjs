#!/usr/bin/env node
/**
 * CALLABLE-SURFACE-0 — inventory the public CALLABLE surface, not just exports.
 *
 * WHY THIS EXISTS. `tools/api-baseline.json` records exported SYMBOLS. It is
 * therefore blind to every callable MEMBER of an exported type: when
 * `proposal()` was added to the already-exported `TransactionMethods`, the
 * baseline recorded only the five new types and never saw the method that made
 * them reachable. Checked across the surface, the hole was total — `settled`,
 * `tap`, `intercept`, `empty`, `exportDebugSession`, `transaction` and
 * `proposal` were all absent. `transaction()` shipped in 15.2.1 without the API
 * gate ever knowing it existed.
 *
 * WHY memberKind IS PART OF THE IDENTITY, NOT METADATA. A grammar audit once
 * proposed renaming `empty()` to `isEmpty()` because it sat beside a mutating
 * `clear()` and read like a command. But `empty` is a readonly property whose
 * VALUE is a reactive callable, while `clear()` is a method. Both are invoked
 * with parentheses at the use site and they are not the same kind of thing.
 * A gate that recorded only "callable: true" would permit silently converting
 * one into the other, which is exactly the misclassification that produced the
 * bad rename proposal.
 *
 * Read from EMITTED DECLARATIONS, never from source: the rule is to gate what
 * consumers can actually type against, so internal machinery that never reaches
 * a barrel is correctly invisible here.
 *
 *   node tools/api-callable-inventory.mjs            # write the baseline
 *   node tools/api-callable-inventory.mjs --check    # compare against it
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';

const ROOT = process.cwd();
const BASELINE = join(ROOT, 'tools', 'api-callable-baseline.json');
const PACKAGES = ['kernel', 'angular', 'react', 'solid', 'vue'];

const entryFor = (pkg) => join(ROOT, 'dist/packages', pkg, 'dist/index.d.ts');

/** method | callable-property | function */
function classify(symbol, checker) {
  const decls = symbol.getDeclarations() ?? [];
  for (const d of decls) {
    if (ts.isMethodSignature(d) || ts.isMethodDeclaration(d)) return 'method';
    if (ts.isFunctionDeclaration(d)) return 'function';
    if (ts.isPropertySignature(d) || ts.isPropertyDeclaration(d)) {
      // A property is only in scope for this inventory when its VALUE can be
      // invoked. `empty` qualifies (a reactive callable); `count` would too.
      const t = checker.getTypeOfSymbolAtLocation(symbol, d);
      return t.getCallSignatures().length > 0 ? 'callable-property' : null;
    }
    if (ts.isVariableDeclaration(d)) {
      const t = checker.getTypeOfSymbolAtLocation(symbol, d);
      return t.getCallSignatures().length > 0 ? 'function' : null;
    }
  }
  return null;
}

function collect() {
  const rows = new Map();
  for (const pkg of PACKAGES) {
    const entry = entryFor(pkg);
    if (!existsSync(entry)) continue;
    const program = ts.createProgram([entry], {
      noEmit: true,
      skipLibCheck: true,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      target: ts.ScriptTarget.ES2022,
    });
    const checker = program.getTypeChecker();
    const source = program.getSourceFile(entry);
    if (!source) continue;
    const moduleSymbol = checker.getSymbolAtLocation(source);
    if (!moduleSymbol) continue;

    for (const exp of checker.getExportsOfModule(moduleSymbol)) {
      const name = exp.getName();
      const resolved =
        exp.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(exp) : exp;

      // Top-level callable export.
      const own = classify(resolved, checker);
      if (own) {
        rows.set(`${pkg}:root.${name}`, {
          pkg,
          owner: 'root',
          name,
          memberKind: own,
        });
      }

      // Members of an exported type — the surface the export baseline misses.
      if (
        resolved.flags &
        (ts.SymbolFlags.Interface |
          ts.SymbolFlags.TypeAlias |
          ts.SymbolFlags.Class)
      ) {
        const decl = resolved.getDeclarations()?.[0];
        if (!decl) continue;
        const type = checker.getDeclaredTypeOfSymbol(resolved);
        for (const member of checker.getPropertiesOfType(type)) {
          const kind = classify(member, checker);
          if (!kind) continue;
          rows.set(`${pkg}:${name}.${member.getName()}`, {
            pkg,
            owner: name,
            name: member.getName(),
            memberKind: kind,
          });
        }
      }
    }
  }
  return [...rows.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([id, v]) => ({ id, ...v }));
}

const rows = collect();
if (!rows.length) {
  console.error(
    '\n❌ no declarations found — run `pnpm nx run-many -t build` first'
  );
  process.exit(1);
}

const serialized = JSON.stringify({ rows }, null, 2) + '\n';

if (!process.argv.includes('--check')) {
  writeFileSync(BASELINE, serialized);
  console.log(`Callable baseline written: ${rows.length} public callables.`);
  process.exit(0);
}

if (!existsSync(BASELINE)) {
  console.error(
    '\n❌ no committed callable baseline; run without --check first'
  );
  process.exit(1);
}

const before = new Map(
  JSON.parse(readFileSync(BASELINE, 'utf8')).rows.map((r) => [r.id, r])
);
const after = new Map(rows.map((r) => [r.id, r]));

const added = [...after.keys()].filter((k) => !before.has(k));
const removed = [...before.keys()].filter((k) => !after.has(k));
const changed = [...after.keys()]
  .filter((k) => before.has(k))
  .filter((k) => before.get(k).memberKind !== after.get(k).memberKind)
  .map(
    (k) => `${k}  ${before.get(k).memberKind} -> ${after.get(k).memberKind}`
  );

if (!added.length && !removed.length && !changed.length) {
  console.log(
    `Callable surface matches the baseline (${rows.length} callables).`
  );
  process.exit(0);
}

console.error('\nPUBLIC CALLABLE SURFACE CHANGED\n');
for (const k of removed)
  console.error(`  REMOVED        ${k}  (${before.get(k).memberKind})`);
for (const k of added)
  console.error(`  ADDED          ${k}  (${after.get(k).memberKind})`);
for (const c of changed) console.error(`  KIND CHANGED   ${c}`);
console.error(
  '\n❌ A public callable was added, removed or changed kind.\n' +
    '   Intentional? Re-run without --check and commit the baseline.\n' +
    '   A method <-> callable-property change is a SEMANTIC change, not a rename:\n' +
    '   `empty` is a reactive property, `clear()` is a method, and conflating them\n' +
    '   is what produced a wrong rename proposal once already.\n'
);
process.exit(1);
