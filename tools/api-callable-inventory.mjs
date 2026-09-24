#!/usr/bin/env node
/**
 * CALLABLE-SURFACE-0 — inventory the public INVOCATION surface, not just
 * exports. "Invocation" rather than "callable" because a constructable class is
 * invoked with `new` and is not callable in JavaScript.
 *
 * Every way a consumer can invoke public API:
 *
 *     root function        signalTree(...)
 *     method               tree.transact(...)
 *     callable property    rows.empty()
 *     callable type        tree.$.name(...)
 *     constructable type   new SignalTreeRollbackError(...)
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
 * WHY SIGNATURES ARE CAPTURED. Recording owner + name + kind protects member
 * EXISTENCE but not member SHAPE. Without signatures this passes silently:
 *
 *     baseline   transact(fn: () => void): PendingTransaction
 *     changed    transact(fn: (x: number) => string, o: Foo): Promise<void>
 *
 * Same owner, same name, same kind, and a total public break.
 *
 * WHY CALLABLE TYPES ARE CAPTURED SEPARATELY. SignalTree's most fundamental API
 * is types that are THEMSELVES callable — `tree.$.name()` reads,
 * `tree.$.name(v)` writes, and an `EntityNode` is invoked directly. Those are
 * call signatures on the type, not properties, so `getPropertiesOfType` cannot
 * see them. That is a far larger surface than any single method.
 *
 * Read from EMITTED DECLARATIONS, never from source: the rule is to gate what
 * consumers can actually type against, so internal machinery that never reaches
 * a barrel is correctly invisible here.
 *
 * SCOPE. This is complete for SignalTree's CURRENT exported invocation forms,
 * not for every pattern TypeScript can express. If the library ever exports an
 * object constant holding nested methods, or adds static class methods, those
 * are new forms and the collector must be revisited then. Extending it
 * speculatively now would add untested branches to a gate whose value comes
 * from being mutation-proven.
 *
 * ⚠️ ONLY MEANINGFUL AGAINST DECLARATIONS BUILT FROM THE CURRENT COMMIT. The
 * first run of this tool read stale declarations left by an abandoned
 * experiment and recorded standalone `root.transact` FUNCTIONS that the source
 * no longer contained. Rebuild before trusting a diff.
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

/** Deterministic, sorted signature list for a type's call signatures. */
function signaturesOf(type, checker) {
  return checker
    .getSignaturesOfType(type, ts.SignatureKind.Call)
    .map((sig) => checker.signatureToString(sig))
    .map((text) => text.replace(/\s+/g, ' ').trim())
    .filter((text, i, all) => all.indexOf(text) === i)
    .sort();
}

/** Construct signatures — `new Exported(...)` — read off the STATIC side. */
function constructSignaturesOf(type, checker) {
  return checker
    .getSignaturesOfType(type, ts.SignatureKind.Construct)
    .map((sig) => checker.signatureToString(sig))
    .map((text) => text.replace(/\s+/g, ' ').trim())
    .filter((text, i, all) => all.indexOf(text) === i)
    .sort();
}

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

// TypeScript's __@iterator@N includes an allocation ID, not public identity.
// Normalize only computed keys resolved to unique-symbol properties of the
// standard-library SymbolConstructor. User unique symbols (even named iterator
// or reached through a shadowed Symbol) retain their distinct checker identities.
function wellKnownMemberName(member, checker, program) {
  const declaration = member.getDeclarations()?.[0];
  if (!declaration?.name || !ts.isComputedPropertyName(declaration.name))
    return undefined;
  const key = checker.getSymbolAtLocation(declaration.name.expression);
  const declarations = key?.getDeclarations();
  if (
    !declarations?.length ||
    !declarations.every(
      (d) =>
        ts.isPropertySignature(d) &&
        ts.isInterfaceDeclaration(d.parent) &&
        d.parent.name.text === 'SymbolConstructor' &&
        program.isSourceFileDefaultLibrary(d.getSourceFile())
    ) ||
    !(
      checker.getTypeOfSymbolAtLocation(key, declarations[0]).flags &
      ts.TypeFlags.UniqueESSymbol
    )
  )
    return undefined;
  return `[Symbol.${key.getName()}]`;
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
        const decl = resolved.getDeclarations()?.[0];
        const t = decl
          ? checker.getTypeOfSymbolAtLocation(resolved, decl)
          : undefined;
        rows.set(`${pkg}:root.${name}`, {
          pkg,
          owner: 'root',
          name,
          memberKind: own,
          signatures: t ? signaturesOf(t, checker) : [],
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

        // `new Exported(...)`. Construct signatures live on the STATIC side and
        // are a DIFFERENT SignatureKind, so neither the call-signature pass nor
        // the property pass can see them. An exported class could change its
        // constructor entirely while its name, members and call signatures all
        // stayed identical.
        const staticDecl = resolved.getDeclarations()?.[0];
        if (staticDecl) {
          const staticType = checker.getTypeOfSymbolAtLocation(
            resolved,
            staticDecl
          );
          const ctors = constructSignaturesOf(staticType, checker);
          if (ctors.length) {
            rows.set(`${pkg}:${name}.new`, {
              pkg,
              owner: name,
              name: 'new',
              memberKind: 'constructable-type',
              signatures: ctors,
            });
          }
        }

        // The TYPE ITSELF may be callable — `tree.$.name()`, `row()`. These are
        // call signatures, not properties, so nothing above would see them.
        const ownCalls = signaturesOf(type, checker);
        if (ownCalls.length) {
          rows.set(`${pkg}:${name}`, {
            pkg,
            owner: name,
            name: '(call)',
            memberKind: 'callable-type',
            signatures: ownCalls,
          });
        }

        for (const member of checker.getPropertiesOfType(type)) {
          const kind = classify(member, checker);
          if (!kind) continue;
          const mdecl = member.getDeclarations()?.[0];
          const mtype = mdecl
            ? checker.getTypeOfSymbolAtLocation(member, mdecl)
            : undefined;
          const wellKnown = wellKnownMemberName(member, checker, program);
          // Bracket identity differs from the dotted identity of a literal
          // string property named "[Symbol.iterator]".
          rows.set(`${pkg}:${name}${wellKnown ?? `.${member.getName()}`}`, {
            pkg,
            owner: name,
            name: wellKnown ?? member.getName(),
            memberKind: kind,
            signatures: mtype ? signaturesOf(mtype, checker) : [],
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
  console.log(
    `Callable baseline written: ${rows.length} entries in the public invocation surface.`
  );
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
const shared = [...after.keys()].filter((k) => before.has(k));
const changed = shared
  .filter((k) => before.get(k).memberKind !== after.get(k).memberKind)
  .map(
    (k) => `${k}  ${before.get(k).memberKind} -> ${after.get(k).memberKind}`
  );
// Member SHAPE, not just existence. Same owner, same name and same kind can
// still be a total public break if the signature moved.
const resigned = shared
  .filter((k) => before.get(k).memberKind === after.get(k).memberKind)
  .filter(
    (k) =>
      JSON.stringify(before.get(k).signatures ?? []) !==
      JSON.stringify(after.get(k).signatures ?? [])
  );

if (!added.length && !removed.length && !changed.length && !resigned.length) {
  console.log(
    `Public invocation surface matches the baseline (${rows.length} entries).`
  );
  process.exit(0);
}

console.error('\nPUBLIC INVOCATION SURFACE CHANGED\n');
for (const k of removed)
  console.error(`  REMOVED        ${k}  (${before.get(k).memberKind})`);
for (const k of added)
  console.error(`  ADDED          ${k}  (${after.get(k).memberKind})`);
for (const c of changed) console.error(`  KIND CHANGED   ${c}`);
for (const k of resigned) {
  console.error(`  SIGNATURE CHANGED  ${k}`);
  for (const sig of before.get(k).signatures ?? [])
    console.error(`      was  ${sig}`);
  for (const sig of after.get(k).signatures ?? [])
    console.error(`      now  ${sig}`);
}
console.error(
  '\n❌ A public callable was added, removed, changed kind or changed shape.\n' +
    '   Intentional? Re-run without --check and commit the baseline.\n' +
    '   A method <-> callable-property change is a SEMANTIC change, not a rename:\n' +
    '   `empty` is a reactive property, `clear()` is a method, and conflating them\n' +
    '   is what produced a wrong rename proposal once already.\n'
);
process.exit(1);
