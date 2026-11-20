// tests/spec-tests.json (BRIEF.md 12.1.6): a content hash for every test tagged
// with a behavior ID from sections 5.1 and 5.2, for example `[T3]`. CI fails
// when a tagged test is added, changed or removed without the same change to
// tests/spec-tests.json, which is code-owned, so changing a spec test needs
// Jonathan's review.
//
//   node ci/spec-tests.mjs check     compare the tests with tests/spec-tests.json (CI)
//   node ci/spec-tests.mjs update    rewrite tests/spec-tests.json from the tests
//
// A tagged unit is an it(), test(), describe() or suite() call whose title
// carries one or more IDs; its hash covers the call's exact source, so a
// tagged describe or suite covers every test inside it. Test files are
// *.spec.ts, *.test.ts and *.prop.ts under packages/ and tests/.
//
// A file with tagged tests may import only (Jonathan, review of #19): a
// package's public entry point (an export of packages/*/package.json), a
// module in the code-owned tests/support/ directory, or a module from outside
// this repository (node: builtins and third-party packages). vi.mock(),
// vi.importActual() and the like count as imports. Editing a helper a spec
// test calls could otherwise weaken it without touching its hash.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import { publicEntries, repoRoot } from './entry-graph.mjs';

export const SPEC_TESTS_PATH = join(repoRoot, 'tests', 'spec-tests.json');
export const BEHAVIOR_ID = /\[(T10|T[1-9]|R[1-4]|E[12]|L[1-3]|X[12]|W[1-4])\]/g;
const TEST_FILE = /\.(spec|test|prop)\.ts$/;
const TEST_FUNCTIONS = new Set(['it', 'test', 'describe', 'suite']);
export const SUPPORT_DIR = 'tests/support';

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'out' || name === 'dist' || name.startsWith('.')) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (TEST_FILE.test(name)) out.push(path);
  }
  return out;
}

/** The test function a call invokes (it, test or describe), looking through .only/.each(...) and the like. */
function testFunction(callee) {
  let node = callee;
  while (node) {
    if (ts.isIdentifier(node)) return TEST_FUNCTIONS.has(node.text) ? node.text : null;
    if (ts.isPropertyAccessExpression(node)) node = node.expression;
    else if (ts.isCallExpression(node)) node = node.expression;
    else return null;
  }
  return null;
}

function titleOf(call) {
  const first = call.arguments[0];
  if (first && (ts.isStringLiteral(first) || ts.isNoSubstitutionTemplateLiteral(first))) return first.text;
  if (first && ts.isTemplateExpression(first)) return first.getText().slice(1, -1);
  return null;
}

/** Tagged units in one file's source: [{ title, ids, sha256 }]. */
export function taggedUnits(source, fileName = 'test.ts') {
  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const units = [];
  const seen = new Map();
  const visit = (node, path) => {
    let childPath = path;
    if (ts.isCallExpression(node) && testFunction(node.expression)) {
      const title = titleOf(node);
      if (title !== null) {
        childPath = [...path, title];
        const ids = [...new Set([...title.matchAll(BEHAVIOR_ID)].map((m) => m[1]))];
        if (ids.length) {
          const key = childPath.join(' > ');
          const n = (seen.get(key) ?? 0) + 1;
          seen.set(key, n);
          units.push({ title: n > 1 ? `${key} (#${n})` : key, ids, sha256: createHash('sha256').update(node.getText(file)).digest('hex') });
        }
      }
    }
    ts.forEachChild(node, (child) => visit(child, childPath));
  };
  visit(file, []);
  return units;
}

// vi.mock() and friends load or replace a module by specifier, so they count as imports.
const VI_MODULE_CALLS = new Set(['mock', 'doMock', 'unmock', 'doUnmock', 'importActual', 'importMock']);

/** Module specifiers a file loads: imports, re-exports, import(), require() and vi module calls with literal paths. */
export function importsOf(source, fileName = 'test.ts') {
  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const found = [];
  const visit = (node) => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      found.push(node.moduleSpecifier.text);
    } else if (ts.isCallExpression(node) && node.arguments.length && ts.isStringLiteralLike(node.arguments[0])) {
      const callee = node.expression;
      const viCall =
        ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.expression) && callee.expression.text === 'vi' && VI_MODULE_CALLS.has(callee.name.text);
      if (callee.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(callee) && callee.text === 'require') || viCall) found.push(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return found;
}

/** Why a specifier is not allowed in a file with tagged tests, or null. `file` is repo-relative. */
export function importProblem(specifier, file, publicSpecifiers) {
  if (specifier.startsWith('.') || specifier.startsWith('/')) {
    const target = join(dirname(file), specifier).split(sep).join('/');
    return target === SUPPORT_DIR || target.startsWith(`${SUPPORT_DIR}/`) ? null : `"${specifier}" is not in ${SUPPORT_DIR}/`;
  }
  if (specifier.startsWith('@signal-tree/')) {
    return publicSpecifiers.has(specifier) ? null : `"${specifier}" is not a package's public entry point`;
  }
  return null;
}

/** Import problems in files that hold tagged tests. */
export function importProblems(root = repoRoot) {
  const publicSpecifiers = new Set(publicEntries(root).map((e) => e.specifier));
  const problems = [];
  for (const path of [...walk(join(root, 'packages')), ...walk(join(root, 'tests'))]) {
    const source = readFileSync(path, 'utf8');
    if (taggedUnits(source, path).length === 0) continue;
    const file = relative(root, path).split(sep).join('/');
    for (const specifier of importsOf(source, path)) {
      const problem = importProblem(specifier, file, publicSpecifiers);
      if (problem) problems.push(`${file}: tagged tests may import only public entry points and ${SUPPORT_DIR}/; ${problem}`);
    }
  }
  return problems;
}

/** Every tagged unit under packages/ and tests/, sorted. */
export function collect(root = repoRoot) {
  const tests = [];
  for (const path of [...walk(join(root, 'packages')), ...walk(join(root, 'tests'))]) {
    const file = relative(root, path).split(sep).join('/');
    for (const unit of taggedUnits(readFileSync(path, 'utf8'), path)) tests.push({ file, ...unit });
  }
  return tests.sort((a, b) => (a.file + a.title < b.file + b.title ? -1 : 1));
}

/** Differences between the recorded tests and the current ones; empty means they match. */
export function compare(recorded, current) {
  const key = (t) => `${t.file} :: ${t.title}`;
  const before = new Map(recorded.map((t) => [key(t), t]));
  const after = new Map(current.map((t) => [key(t), t]));
  const problems = [];
  for (const [k, t] of after) {
    if (!before.has(k)) problems.push(`added, not recorded: ${k} [${t.ids.join(', ')}]`);
    else if (before.get(k).sha256 !== t.sha256) problems.push(`changed: ${k}`);
    else if (before.get(k).ids.join() !== t.ids.join()) problems.push(`behavior IDs changed: ${k}`);
  }
  for (const k of before.keys()) if (!after.has(k)) problems.push(`removed: ${k}`);
  return problems;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const command = process.argv[2] ?? 'check';
  const current = collect();
  if (command === 'update') {
    writeFileSync(SPEC_TESTS_PATH, `${JSON.stringify({ tests: current }, null, 2)}\n`);
    console.log(`recorded ${current.length} tagged test unit(s) in tests/spec-tests.json`);
  } else if (command === 'check') {
    const recorded = existsSync(SPEC_TESTS_PATH) ? JSON.parse(readFileSync(SPEC_TESTS_PATH, 'utf8')).tests ?? [] : null;
    if (!recorded) {
      console.log('FAIL tests/spec-tests.json is missing');
      process.exit(1);
    }
    const problems = [...compare(recorded, current), ...importProblems()];
    for (const p of problems) console.log(`FAIL ${p}`);
    console.log(
      problems.length
        ? `${problems.length} spec test change(s) not recorded. Run node ci/spec-tests.mjs update in the same pull request; tests/spec-tests.json is code-owned.`
        : `ok: ${current.length} tagged test unit(s) match tests/spec-tests.json.`,
    );
    process.exit(problems.length ? 1 : 0);
  } else {
    console.error('usage: node ci/spec-tests.mjs check | update');
    process.exit(2);
  }
}
