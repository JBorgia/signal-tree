#!/usr/bin/env node
/**
 * A package barrel must not ADVERTISE a symbol it does not EXPORT.
 *
 * ## The gap this fills, and the defect that earned it
 *
 * Three gates already ask neighbouring questions and none asks this one:
 *
 *   lint-readme-apis        does a symbol named in a shipped README exist in the
 *                           built entry point?          (READMEs only)
 *   check-documented-imports can a user write the documented SPECIFIER?
 *                                                       (specifiers only)
 *   find-dead-exports       is an exported symbol reachable?
 *                                                       (the other direction)
 *   MISSING                 does the BARREL's own "PUBLIC API SUMMARY" name
 *                           things the barrel does not export?
 *
 * A2-REOPEN found the consequence. `c53aa416` ("remove stored marker from public
 * rc surface") deleted the `stored` export block from `packages/core/src/index.ts`
 * and swept the READMEs, guides and demo — but left the barrel's own API summary
 * still teaching ``- `stored(key, default)` - localStorage persistence``. Every
 * gate stayed green: the README linter does not read source files, and the
 * specifier gate checks paths, not names.
 *
 * That is not a cosmetic stale comment. The barrel's summary is the most
 * authoritative list of what a package offers, it ships inside the tarball as
 * source, and it is what an agent reads first.
 *
 * ## Scope, deliberately narrow
 *
 * ONLY the bullet entries of an "API SUMMARY" comment block, in the form
 *
 *     * - `name(...)` - description
 *
 * Barrel comments legitimately discuss symbols that are internal, deleted or
 * deliberately unexported ("`getPathNotifier` is not root app API"). Scanning
 * every backticked identifier would fire on all of those, and a gate that cries
 * wolf gets ignored. The summary LIST is unambiguous: it is a claim of public
 * API in a place that exists to make exactly that claim.
 *
 * Coverage is every `packages/<name>/src/index.ts` that exists — currently core
 * and shared. `events` and `ng-forms` are node_modules leftovers with no source,
 * and `authoring`'s src is empty; a real barrel appearing there is picked up
 * automatically rather than needing a list edit.
 *
 *   node tools/check-documented-symbols.mjs
 *   node tools/check-documented-symbols.mjs --self-test
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';

const ROOT = new URL('..', import.meta.url).pathname;

/** Every name a source barrel re-exports or declares as exported. */
export function exportedNames(file) {
  const src = ts.createSourceFile(
    file,
    readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true
  );
  const names = new Set();
  const isExported = (node) =>
    node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);

  src.forEachChild((node) => {
    if (ts.isExportDeclaration(node) && node.exportClause) {
      if (ts.isNamedExports(node.exportClause)) {
        for (const el of node.exportClause.elements) names.add(el.name.text);
      }
    } else if (
      (ts.isFunctionDeclaration(node) ||
        ts.isClassDeclaration(node) ||
        ts.isInterfaceDeclaration(node) ||
        ts.isTypeAliasDeclaration(node) ||
        ts.isEnumDeclaration(node)) &&
      isExported(node) &&
      node.name
    ) {
      names.add(node.name.text);
    } else if (ts.isVariableStatement(node) && isExported(node)) {
      for (const d of node.declarationList.declarations) {
        if (ts.isIdentifier(d.name)) names.add(d.name.text);
      }
    }
  });
  return names;
}

/**
 * Bullet claims inside an API-SUMMARY comment block.
 *
 * Method-style entries (`.derived($)`) are skipped: they name a member of a
 * returned object, not a barrel export, so the barrel is the wrong place to
 * check them.
 */
export function summaryClaims(text) {
  const claims = [];
  const block = /\/\*\*[\s\S]*?API SUMMARY[\s\S]*?\*\//i.exec(text);
  const scope = block
    ? block[0]
    : (/\/\*\*[\s\S]*?API Summary[\s\S]*?\*\//.exec(text)?.[0] ?? '');
  if (!scope) return claims;
  for (const m of scope.matchAll(/^\s*\*\s*-\s*`([^`]+)`/gm)) {
    const raw = m[1].trim();
    if (raw.startsWith('.')) continue;
    const name = /^([A-Za-z_$][\w$]*)/.exec(raw)?.[1];
    if (name) claims.push({ name, raw });
  }
  return claims;
}

function barrels() {
  const dir = join(ROOT, 'packages');
  return readdirSync(dir)
    .map((p) => ({ pkg: p, file: join(dir, p, 'src/index.ts') }))
    .filter((b) => existsSync(b.file));
}

if (process.argv.includes('--self-test')) {
  // The fixture reproduces the exact defect: a summary bullet for a name the
  // barrel does not export, next to one it does.
  const fixture = `
export { real } from './real';
/**
 * Pkg API Summary:
 *
 * **Things:**
 * - \`real(x)\` - exported, must pass
 * - \`ghost(key, default)\` - NOT exported, must be caught
 * - \`.method($)\` - a member, must be skipped
 */
`;
  const claims = summaryClaims(fixture);
  const names = new Set(['real']);
  const missed = claims.filter((c) => !names.has(c.name)).map((c) => c.name);
  const skipped = !claims.some((c) => c.raw.startsWith('.'));
  const ok =
    claims.length === 2 &&
    skipped &&
    missed.length === 1 &&
    missed[0] === 'ghost';
  console.log(
    `  ${claims.length === 2 && skipped ? 'ok  ' : 'FAIL'}  parses 2 symbol claims and skips the .method entry (got ${claims.length})`
  );
  console.log(
    `  ${missed.length === 1 && missed[0] === 'ghost' ? 'ok  ' : 'FAIL'}  rejects the unexported claim and accepts the exported one (got [${missed}])`
  );
  console.log(
    ok
      ? '\n✅ self-test: the gate catches a summary bullet the barrel does not export.'
      : '\n❌ self-test FAILED — the gate cannot tell an advertised export from a real one.'
  );
  process.exit(ok ? 0 : 1);
}

const problems = [];
let checked = 0;
const list = barrels();
for (const { pkg, file } of list) {
  const text = readFileSync(file, 'utf8');
  const names = exportedNames(file);
  for (const claim of summaryClaims(text)) {
    checked++;
    if (!names.has(claim.name)) {
      problems.push({ pkg, file: `packages/${pkg}/src/index.ts`, ...claim });
    }
  }
}

console.log(
  `Checked ${checked} API-summary symbol claim(s) across ${list.length} package barrel(s).`
);

if (problems.length === 0) {
  console.log('✓ every symbol a barrel advertises is a symbol it exports.');
  process.exit(0);
}

console.error(`\n✗ ${problems.length} advertised symbol(s) the barrel does not export:\n`);
for (const p of problems) {
  console.error(`    ${p.file}\n      \`${p.raw}\` — \`${p.name}\` is not exported\n`);
}
console.error(
  'A barrel summary is a claim of public API in the one place that exists to make it.\n' +
    'Either export the symbol, or stop advertising it.'
);
process.exit(1);
