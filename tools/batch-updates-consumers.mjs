#!/usr/bin/env node
/**
 * BATCH-UPDATES-SURVIVAL-0 — workspace-wide, symbol-resolved consumer census
 * for `TreeConfig.batchUpdates`.
 *
 *     A ZERO-CONSUMER CLAIM IS ONLY AS LARGE AS THE CONSUMER UNIVERSE IT
 *     SEARCHED.
 *
 * Every first-party project is discovered mechanically and compiled with ITS
 * OWN tsconfig; every `.batchUpdates` access is resolved to a property symbol
 * and compared against `TreeConfig`'s declaration. A same-named property on an
 * unrelated type cannot count, and an aliased or spread access cannot be missed.
 *
 * ⚠️ THE POSITIVE CONTROL IS NOT OPTIONAL. "We found no consumers" and "our
 * scanner cannot see consumers" produce identical output. So the same scan also
 * traces a symbol that MUST have cross-package uses — `signalTree` — and the run
 * fails if it does not find them.
 */
import ts from 'typescript';
import { relative } from 'node:path';
import { discoverProjects, danglingPathMappings } from './workspace-projects.mjs';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const rel = (p) => relative(ROOT, p);

const projects = discoverProjects();
const skip = new Set((process.env['SKIP_PROJECTS'] ?? '').split(',').filter(Boolean));
const active = projects.filter((p) => p.options && !skip.has(p.name));
if (skip.size) console.log(`⚠️  SKIPPING projects (mutation): ${[...skip].join(', ')}\n`);

/** Locate the authoritative declarations once, from core's own program. */
const core = active.find((p) => p.name === 'packages/kernel');
if (!core) {
  console.error('❌ packages/kernel not among discovered projects — cannot trace.');
  process.exit(1);
}
const coreProgram = ts.createProgram(core.fileNames, core.options);
// ⚠️ RESTRICT TO CORE'S OWN INPUTS. The Program also loads `.d.ts` files —
// including a PUBLISHED `@signal-tree/kernel` typing that declares its own
// `TreeConfig`. Matching that one produced a declaration key from a file the
// workspace does not compile, so every real use failed to match and the scan
// reported zero everywhere. The positive control is what surfaced it.
let batchUpdatesKey = null;
let signalTreeKeyGlobal = null;
const coreInputs = new Set(core.fileNames);
for (const sf of coreProgram.getSourceFiles()) {
  if (sf.isDeclarationFile || !coreInputs.has(sf.fileName)) continue;
  const visit = (n) => {
    if (ts.isInterfaceDeclaration(n) && n.name.text === 'TreeConfig')
      for (const m of n.members)
        if (
          ts.isPropertySignature(m) &&
          m.name &&
          ts.isIdentifier(m.name) &&
          m.name.text === 'batchUpdates'
        )
          batchUpdatesKey ??= `${sf.fileName}:${m.getStart(sf)}`;
    if (ts.isFunctionDeclaration(n) && n.name?.text === 'signalTree')
      signalTreeKeyGlobal ??= `${sf.fileName}:${n.getStart(sf)}`;
    ts.forEachChild(n, visit);
  };
  ts.forEachChild(sf, visit);
}
if (!batchUpdatesKey) {
  console.error('❌ TreeConfig.batchUpdates declaration not found in core inputs.');
  process.exit(1);
}
console.log(`declaration: ${rel(batchUpdatesKey.split(':')[0])}`);

const category = (file, projectName) => {
  if (file.includes('.spec.') || file.includes('.e2e.')) return 'tests/specs';
  if (projectName.startsWith('apps/')) return 'applications';
  if (projectName === 'packages/kernel') return 'core production';
  return 'other package production';
};

const found = { batchUpdates: [], signalTree: [] };

for (const p of active) {
  const program = ts.createProgram(p.fileNames, p.options);
  const checker = program.getTypeChecker();
  // ⚠️ DECLARATION IDENTITY ACROSS PROGRAMS IS BY SOURCE POSITION. Each project
  // compiles core's sources into its OWN Program, so the node objects differ
  // even though the declaration is the same one. Comparing object identity here
  // would silently find zero consumers in every project except core.
  const targetKey = batchUpdatesKey;
  const signalTreeKey = signalTreeKeyGlobal;
  const sameDecl = (d, key) => {
    if (!key) return false;
    try {
      return `${d.getSourceFile().fileName}:${d.getStart()}` === key;
    } catch {
      return false; // synthesized or lib nodes have no source file
    }
  };
  const hits = (node, key) => {
    let sym = checker.getSymbolAtLocation(node);
    if (!sym) return false;
    if (sym.flags & ts.SymbolFlags.Alias) {
      try { sym = checker.getAliasedSymbol(sym); } catch { /* keep */ }
    }
    return (sym.declarations ?? []).some((d) => sameDecl(d, key));
  };
  for (const sf of program.getSourceFiles()) {
    if (sf.isDeclarationFile || !p.fileNames.includes(sf.fileName)) continue;
    const visit = (n) => {
      if (
        (ts.isPropertyAccessExpression(n) && n.name.text === 'batchUpdates' && hits(n.name, targetKey)) ||
        (ts.isPropertyAssignment(n) &&
          ts.isIdentifier(n.name) &&
          n.name.text === 'batchUpdates' &&
          hits(n.name, targetKey))
      )
        found.batchUpdates.push({
          project: p.name, file: rel(sf.fileName),
          category: category(sf.fileName, p.name),
          text: (() => {
            try { return n.getText().slice(0, 80).replace(/\s+/g, ' '); } catch { return '(unavailable)'; }
          })(),
        });
      if (signalTreeKey && ts.isIdentifier(n) && n.text === 'signalTree' && hits(n, signalTreeKey))
        found.signalTree.push({ project: p.name, file: rel(sf.fileName) });
      ts.forEachChild(n, visit);
    };
    ts.forEachChild(sf, visit);
  }
}

console.log('projects searched:');
for (const p of active) console.log(`  ${p.name.padEnd(20)} ${p.fileNames.length} inputs  (${p.config})`);

const byCat = {};
for (const u of found.batchUpdates) (byCat[u.category] ??= []).push(u);
console.log(`\nTreeConfig.batchUpdates uses: ${found.batchUpdates.length}`);
for (const cat of ['core production', 'other package production', 'applications', 'tests/specs']) {
  const list = byCat[cat] ?? [];
  console.log(`\n  ${cat}: ${list.length}`);
  for (const u of list) console.log(`      ${u.file}\n        ${u.text}`);
}

// ── positive control ────────────────────────────────────────────────────────
const crossPackage = found.signalTree.filter((u) => u.project !== 'packages/kernel');
const projectsSeeing = [...new Set(crossPackage.map((u) => u.project))];
console.log(
  `\npositive control — cross-package uses of \`signalTree\`: ${crossPackage.length}` +
    ` across ${projectsSeeing.length} project(s) ${JSON.stringify(projectsSeeing)}`
);
const dangling = danglingPathMappings();
if (dangling.length) console.log(`\n⚠️  ${dangling.length} dangling path mapping(s) — imports through these would not resolve:`);
for (const d of dangling) console.log(`      ${d.spec} -> ${d.target}`);

if (!crossPackage.length) {
  console.error(
    '\n❌ POSITIVE CONTROL FAILED: the scanner found no cross-package use of a\n' +
      '   core API that certainly has them. A zero result for batchUpdates would\n' +
      '   be indistinguishable from a scanner that cannot see consumers.'
  );
  process.exit(1);
}
console.log('\n✅ scanner demonstrably sees cross-package core API consumers.');
