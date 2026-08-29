#!/usr/bin/env node
/**
 * C6.1 — what semantic service does Angular actually provide, and where?
 *
 * ⚠️ IMPORT SYNTAX IS NOT THE DISCRIMINATOR. The ownership census flags an
 * import STATEMENT as type-only, so `Signal` and `WritableSignal` appear as
 * "value" imports in 8 and 7 files merely by sharing a statement with a real
 * runtime symbol. They are types; they cannot exist at runtime and erase
 * completely. Counting them as framework runtime coupling would inflate the C6
 * problem with work that does not exist.
 *
 * This walks the AST and records, per Angular symbol, whether each reference is
 * in a VALUE position (survives to runtime) or a TYPE position (erases).
 */
import ts from 'typescript';
const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const parsed = ts.getParsedCommandLineOfConfigFile(`${ROOT}/packages/kernel/tsconfig.lib.json`, {}, {
  ...ts.sys, onUnRecoverableConfigFileDiagnostic: (d) => { throw new Error(String(d.messageText)); },
});
const files = parsed.fileNames.filter((f) => !/\.spec\.ts$/.test(f) && f.includes('/packages/kernel/src/'));
const program = ts.createProgram(files, parsed.options);

const svc = new Map(); // symbol -> { value:Map<file,count>, type:Map<file,count> }
for (const sf of program.getSourceFiles()) {
  if (!files.includes(sf.fileName)) continue;
  const rel = sf.fileName.replace(`${ROOT}/packages/kernel/src/`, '');
  const imported = new Set();
  ts.forEachChild(sf, (n) => {
    if (ts.isImportDeclaration(n) && n.moduleSpecifier.getText(sf).includes('@angular/core')) {
      const b = n.importClause?.namedBindings;
      if (b && ts.isNamedImports(b)) for (const el of b.elements) imported.add(el.name.text);
    }
  });
  if (!imported.size) continue;
  const visit = (n, inType) => {
    const nowType = inType || ts.isTypeNode(n) || ts.isTypeAliasDeclaration(n) ||
      ts.isInterfaceDeclaration(n) || ts.isTypeParameterDeclaration(n) ||
      (ts.isImportDeclaration(n));
    if (ts.isIdentifier(n) && imported.has(n.text)) {
      const rec = svc.get(n.text) ?? { value: new Map(), type: new Map() };
      const bucket = nowType ? rec.type : rec.value;
      bucket.set(rel, (bucket.get(rel) ?? 0) + 1);
      svc.set(n.text, rec);
    }
    ts.forEachChild(n, (c) => visit(c, nowType));
  };
  visit(sf, false);
}

// ── machine-readable output for the ownership census ──────────────────────
if (process.argv.includes('--json')) {
  const byFile = {};
  for (const [name, rec] of svc) {
    for (const f of rec.value.keys()) (byFile[f] ??= { value: [], type: [] }).value.push(name);
    for (const f of rec.type.keys()) {
      if (!rec.value.has(f)) (byFile[f] ??= { value: [], type: [] }).type.push(name);
    }
  }
  for (const v of Object.values(byFile)) { v.value.sort(); v.type.sort(); }
  console.log(JSON.stringify(byFile));
  process.exit(0);
}

console.log('ANGULAR SYMBOL          VALUE-POSITION USES              TYPE-ONLY');
for (const [name, rec] of [...svc].sort((a, b) => b[1].value.size - a[1].value.size)) {
  const vf = [...rec.value.keys()].sort();
  console.log(`\n  ${name}  —  value in ${vf.length} file(s), type in ${rec.type.size}`);
  for (const f of vf) console.log(`      ${String(rec.value.get(f)).padStart(3)}×  ${f}`);
}
