#!/usr/bin/env node
/**
 * Symbol-resolved consumer census for any `TreeConfig` property.
 *
 * Generalized from `batch-updates-consumers.mjs`, which proved this exact
 * question for `batchUpdates` — a config property that had authoring surface and
 * no production decision behind it.
 *
 *     A CONFIG PROPERTY DOES NOT EARN SURVIVAL BECAUSE IT ONCE CONFIGURED
 *     SOMETHING.
 *
 * ⚠️ DECLARATION COMPARISON, NOT SYMBOL IDENTITY. `TreeConfig | undefined`
 * contextual types make the checker synthesize union property symbols that fail
 * strict identity — that defect under-counted a census 2-vs-8 earlier in this
 * audit and was caught only by tsc.
 */
import ts from 'typescript';
const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const parsed = ts.getParsedCommandLineOfConfigFile(`${ROOT}/packages/kernel/tsconfig.lib.json`, {}, {
  ...ts.sys, onUnRecoverableConfigFileDiagnostic: (d) => { throw new Error(String(d.messageText)); },
});
const program = ts.createProgram(parsed.fileNames, parsed.options);
const checker = program.getTypeChecker();
const PROPS = process.argv.slice(2);
if (!PROPS.length) { console.error('usage: tree-config-consumers.mjs <prop...>'); process.exit(2); }

const decls = new Map();
for (const sf of program.getSourceFiles()) {
  if (!sf.fileName.endsWith('lib/types.ts')) continue;
  ts.forEachChild(sf, function walk(n) {
    if (ts.isInterfaceDeclaration(n) && n.name.text === 'TreeConfig') {
      for (const m of n.members) {
        if (m.name && ts.isIdentifier(m.name) && PROPS.includes(m.name.text)) decls.set(m.name.text, m);
      }
    }
    ts.forEachChild(n, walk);
  });
}
for (const p of PROPS) if (!decls.has(p)) { console.error(`❌ TreeConfig.${p} not declared — instrument or subject is wrong.`); process.exit(1); }

const hits = new Map(PROPS.map((p) => [p, []]));
for (const sf of program.getSourceFiles()) {
  if (!sf.fileName.includes('/packages/kernel/src/') || /\.spec\.ts$/.test(sf.fileName)) continue;
  if (sf.fileName.endsWith('lib/types.ts')) continue;
  const rel = sf.fileName.replace(`${ROOT}/packages/kernel/src/`, '');
  const visit = (n) => {
    if (ts.isPropertyAccessExpression(n) && PROPS.includes(n.name.text)) {
      const s = checker.getSymbolAtLocation(n.name);
      const target = decls.get(n.name.text);
      if (s?.declarations?.some((d) => d === target))
        hits.get(n.name.text).push(`${rel}:${sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1}`);
    }
    if (ts.isBindingElement(n) && ts.isObjectBindingPattern(n.parent)) {
      const nm = n.propertyName ?? n.name;
      if (ts.isIdentifier(nm) && PROPS.includes(nm.text)) {
        const t2 = checker.getTypeAtLocation(n.parent);
        const p2 = t2 && checker.getPropertyOfType(t2, nm.text);
        if (p2?.declarations?.some((d) => d === decls.get(nm.text)))
          hits.get(nm.text).push(`${rel}:${sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1} (destructured)`);
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
}
for (const p of PROPS) {
  const h = hits.get(p);
  console.log(`TreeConfig.${p}: ${h.length} production reader(s)`);
  for (const x of h.slice(0, 6)) console.log(`    ${x}`);
}
