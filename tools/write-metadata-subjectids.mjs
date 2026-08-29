#!/usr/bin/env node
/**
 * Symbol-resolved producer/consumer census for ONE property:
 * `WriteMetadata.subjectIds`.
 *
 * ⚠️ A TEXT SEARCH CANNOT ANSWER THIS. A shorthand `{ subjectIds }` in a meta
 * literal is a write to this property and matches no `.subjectIds` pattern,
 * while `bucket.subjectIds` matches and is an unrelated Set. Every candidate is
 * resolved to its declaration symbol and compared against the declaration in
 * mutation-types.ts.
 */
import ts from 'typescript';
const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const CFG = `${ROOT}/packages/kernel/tsconfig.lib.json`;
const PROP = process.argv[2] ?? 'subjectIds';
const parsed = ts.getParsedCommandLineOfConfigFile(CFG, {}, {
  ...ts.sys, onUnRecoverableConfigFileDiagnostic: (d) => { throw new Error(String(d.messageText)); },
});
const program = ts.createProgram(parsed.fileNames, parsed.options);
const checker = program.getTypeChecker();

// locate the declaration
let target = null;
let targetDecl = null;
for (const sf of program.getSourceFiles()) {
  if (!sf.fileName.endsWith('lib/mutation-types.ts')) continue;
  ts.forEachChild(sf, function walk(n) {
    if (ts.isInterfaceDeclaration(n) && n.name.text === 'WriteMetadata') {
      for (const m of n.members) {
        if (m.name && ts.isIdentifier(m.name) && m.name.text === PROP) {
          target = checker.getSymbolAtLocation(m.name);
          targetDecl = m;
        }
      }
    }
    ts.forEachChild(n, walk);
  });
}
if (!target) { console.error(`❌ WriteMetadata.${PROP} declaration not found — instrument broken.`); process.exit(1); }
console.log(`declaration resolved: WriteMetadata.${PROP}`);

const hits = { write: [], read: [] };
for (const sf of program.getSourceFiles()) {
  if (!sf.fileName.includes('/packages/kernel/src/') || /\.spec\.ts$/.test(sf.fileName)) continue;
  const rel = sf.fileName.replace(`${ROOT}/packages/kernel/src/`, '');
  const visit = (n) => {
    const record = (kind, nameNode, bucket, want) => {
      const s = checker.getSymbolAtLocation(nameNode);
      const resolved = s && (s.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(s) : s);
      const match = resolved === want || !!resolved?.declarations?.some((d) => d === targetDecl);
      if (match) bucket[kind].push(`${rel}:${sf.getLineAndCharacterOfPosition(nameNode.getStart(sf)).line + 1}`);
    };
    if ((ts.isPropertyAssignment(n) || ts.isShorthandPropertyAssignment(n)) && ts.isIdentifier(n.name) && n.name.text === PROP) {
      // ⚠️ NOT `getPropertyOfType(t, PROP) === target`. A contextual type of
      // `WriteMetadata | undefined` — which every optional `metaOverride?:`
      // parameter produces — makes the checker SYNTHESIZE a union property
      // symbol that fails strict identity against the declaration symbol. That
      // silently under-counted writers 2 vs 8 and was caught only because tsc
      // failed on sites the census had reported as absent.
      //
      //     COMPARE DECLARATIONS, NOT SYMBOL IDENTITY.
      const t = checker.getContextualType(n.parent);
      const isTarget = (sym) => !!sym?.declarations?.some((d) => d === targetDecl);
      const cands = [];
      if (t) {
        const parts = t.isUnion?.() ? t.types : [t];
        for (const part of parts) { const pr = checker.getPropertyOfType(part, PROP); if (pr) cands.push(pr); }
        const direct = checker.getPropertyOfType(t, PROP); if (direct) cands.push(direct);
      }
      if (cands.some(isTarget)) hits.write.push(`${rel}:${sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1}`);
    }
    if (ts.isPropertyAccessExpression(n) && n.name.text === PROP) record('read', n.name, hits, target);
    if (ts.isBindingElement(n) && ts.isObjectBindingPattern(n.parent)) {
      const nm = n.propertyName ?? n.name;
      if (ts.isIdentifier(nm) && nm.text === PROP) {
        const t2 = checker.getTypeAtLocation(n.parent);
        const p2 = t2 && checker.getPropertyOfType(t2, PROP);
        if (p2 === target || p2?.declarations?.some((d) => d === targetDecl)) hits.read.push(`${rel}:${sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1} (destructured)`);
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
}
console.log(`\nWriteMetadata.${PROP} WRITES: ${hits.write.length}`);
for (const h of hits.write) console.log(`  ${h}`);
console.log(`WriteMetadata.${PROP} READS:  ${hits.read.length}`);
for (const h of hits.read) console.log(`  ${h}`);
