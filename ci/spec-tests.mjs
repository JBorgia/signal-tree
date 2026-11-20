// tests/spec-tests.json (BRIEF.md 12.1.6): a content hash for every test tagged
// with a behavior ID from sections 5.1 and 5.2, for example `[T3]`. CI fails
// when a tagged test is added, changed or removed without the same change to
// tests/spec-tests.json, which is code-owned, so changing a spec test needs
// Jonathan's review.
//
//   node ci/spec-tests.mjs check     compare the tests with tests/spec-tests.json (CI)
//   node ci/spec-tests.mjs update    rewrite tests/spec-tests.json from the tests
//
// A tagged unit is an it(), test() or describe() call whose title carries one
// or more IDs; its hash covers the call's exact source, so a tagged describe
// covers every test inside it. Test files are *.spec.ts, *.test.ts and
// *.prop.ts under packages/ and tests/.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import { repoRoot } from './entry-graph.mjs';

export const SPEC_TESTS_PATH = join(repoRoot, 'tests', 'spec-tests.json');
export const BEHAVIOR_ID = /\[(T10|T[1-9]|R[1-4]|E[12]|L[1-3]|X[12]|W[1-4])\]/g;
const TEST_FILE = /\.(spec|test|prop)\.ts$/;
const TEST_FUNCTIONS = new Set(['it', 'test', 'describe']);

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
    const problems = compare(recorded, current);
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
