#!/usr/bin/env node
/**
 * Permanent control for Angular RUNTIME-COUPLING classification.
 *
 * The ownership census once decided `angular-value` vs `angular-type` from the
 * import STATEMENT's `type` modifier. That marked three modules as runtime
 * coupled which emit no `@angular/core` import at all, creating three C6
 * REIMPLEMENT actions for work that does not exist.
 *
 *     IMPORT STATEMENT KIND DOES NOT ESTABLISH RUNTIME COUPLING.
 *     VALUE-POSITION USE DOES.
 *
 * The fixture below is the exact shape that defeated the old rule: ONE runtime
 * symbol and ONE erased type in a single non-`type` import statement.
 */
import ts from 'typescript';

const FIXTURE = `
import { signal, Signal, WritableSignal } from '@angular/core';

// PLANTED VALUE USE — survives to runtime.
export function makeCell(v: number) {
  return signal(v);
}

// PLANTED TYPE-ONLY USES — erase completely.
export type Readable = Signal<number>;
export function widen(s: WritableSignal<number>): WritableSignal<number> {
  return s;
}
`;

/** The classifier under test, in the same shape the census uses. */
function classify(src) {
  const sf = ts.createSourceFile('fixture.ts', src, ts.ScriptTarget.ES2022, true);
  const imported = new Set();
  ts.forEachChild(sf, (n) => {
    if (ts.isImportDeclaration(n) && n.moduleSpecifier.getText(sf).includes('@angular/core')) {
      const b = n.importClause?.namedBindings;
      if (b && ts.isNamedImports(b)) for (const el of b.elements) imported.add(el.name.text);
    }
  });
  const value = new Set(), type = new Set();
  const visit = (n, inType) => {
    const nowType = inType || ts.isTypeNode(n) || ts.isTypeAliasDeclaration(n) ||
      ts.isInterfaceDeclaration(n) || ts.isTypeParameterDeclaration(n) || ts.isImportDeclaration(n);
    if (ts.isIdentifier(n) && imported.has(n.text)) (nowType ? type : value).add(n.text);
    ts.forEachChild(n, (c) => visit(c, nowType));
  };
  visit(sf, false);
  return { value: [...value].sort(), type: [...type].filter((x) => !value.has(x)).sort() };
}

/** The MUTATION: the rule this replaced. */
function classifyByStatementKind(src) {
  const sf = ts.createSourceFile('fixture.ts', src, ts.ScriptTarget.ES2022, true);
  let runtime = false;
  const symbols = [];
  ts.forEachChild(sf, (n) => {
    if (ts.isImportDeclaration(n) && n.moduleSpecifier.getText(sf).includes('@angular/core')) {
      if (!n.importClause?.isTypeOnly) runtime = true;
      const b = n.importClause?.namedBindings;
      if (b && ts.isNamedImports(b)) for (const el of b.elements) symbols.push(el.name.text);
    }
  });
  return { runtime, symbols };
}

let failures = 0;
const check = (name, ok, detail) => {
  console.log(`  ${ok ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
};

const r = classify(FIXTURE);
check('planted VALUE symbol is runtime coupling', r.value.includes('signal'), `value: ${r.value.join(',')}`);
check('planted TYPE symbol is NOT runtime coupling', !r.value.includes('Signal'), `type: ${r.type.join(',')}`);
check('second TYPE symbol is NOT runtime coupling', !r.value.includes('WritableSignal'));
check('type symbols are still reported as type coupling',
  r.type.includes('Signal') && r.type.includes('WritableSignal'), r.type.join(','));

// the mutation must MISCLASSIFY this fixture — that is what makes it a control
const m = classifyByStatementKind(FIXTURE);
check('statement-kind rule WOULD misclassify the types as runtime',
  m.runtime === true && m.symbols.includes('Signal'),
  'it marks the whole statement runtime, dragging Signal/WritableSignal in');

// and the real census must agree with the emitted artifact on a known module
const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
try {
  const census = JSON.parse(
    (await import('node:child_process')).execSync(
      `node ${ROOT}/tools/angular-service-census.mjs --json`, { encoding: 'utf8' }));
  const t = census['lib/types.ts'];
  check('real run: lib/types.ts has no value-position Angular use',
    !!t && t.value.length === 0, `value: [${t?.value ?? '?'}]`);
} catch (e) {
  check('real run reachable', false, String(e).slice(0, 80));
}

if (failures) { console.error(`\n❌ angular-coupling control: ${failures} failure(s).`); process.exit(1); }
console.log('\n✅ angular-coupling control: runtime coupling is decided by value-position use.');
