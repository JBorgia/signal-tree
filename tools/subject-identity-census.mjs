#!/usr/bin/env node
/**
 * SUBJECT-IDENTITY-OWNERSHIP-0 — census of live subject-identity sites.
 *
 * ⚠️ THIS TOOL'S FIRST VERSION OVERCLAIMED, in two ways that are worth naming
 * because both are easy to repeat:
 *
 *   1. It reported "995 total / 995 runtime" — every site classified as a
 *      runtime read — because it decided type-vs-value by walking `node.parent`
 *      UPWARD. Parent links are not reliable for every node (an earlier run of
 *      a sibling tool crashed on a parentless node), and a predicate that
 *      silently returns false for everything looks exactly like "no type
 *      positions exist". `inType` is now carried DOWNWARD through the walk,
 *      where it cannot be wrong about a node it never had to ask about.
 *
 *   2. It assigned semantic families by FILE, which violates a frozen rule:
 *
 *          SAME FILE DOES NOT IMPLY SAME SEMANTIC DOMAIN.
 *
 *      `entity-signal.ts` is the counterexample in its own census — it holds
 *      structural identity work AND reclamation/retention decisions. Families
 *      are now assigned per ENCLOSING FUNCTION, and one file may contribute to
 *      several.
 *
 * Neither defect touched the SI-A/SI-C ruling, which rests on measured
 * lifecycle discriminators rather than on this denominator. But the coverage
 * claim had not been earned, so the numbers below are new — count continuity
 * with the retracted 995 is explicitly not a goal.
 */
import ts from 'typescript';
import { writeFileSync } from 'node:fs';
const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const parsed = ts.getParsedCommandLineOfConfigFile(`${ROOT}/packages/kernel/tsconfig.lib.json`, {}, {
  ...ts.sys, onUnRecoverableConfigFileDiagnostic: (d) => { throw new Error(String(d.messageText)); },
});
const files = parsed.fileNames.filter((f) => !/\.spec\.ts$/.test(f) && f.includes('/packages/kernel/src/'));
const program = ts.createProgram(files, parsed.options);

const NAMES = new Set(['subjectId', 'subjectIds', '__subjectIds', 'subjectIdForKey',
  'allocateFreshSubjectId', 'planFreshSubjectIds', 'nextSubjectId', 'subjectIdsByKey',
  'lastSubjectIds', 'subjectIdsForWrite', 'rememberSubjectIds', 'resolveSubjectId',
  'allocateSubjectId', 'beforeSubject', 'afterSubject', 'createSubject', 'forgetSubject',
  'tombstoneSubject', 'activateSubject', 'transferSubject', 'retireSubject']);

/**
 * Syntactic role, decided from the node's position — not from its name.
 *
 * ⚠️ THE PARENT IS PASSED IN, not read off `id.parent`. Relying on the
 * back-pointer made every one of 904 sites classify as READ, which is the same
 * failure shape as the type-position bug above: an unreliable lookup that fails
 * uniformly is indistinguishable from a real uniform answer. The walk already
 * knows the parent, so it hands it over.
 */
function roleOf(id, p, gpArg) {
  if (!p) return 'READ';
  if (ts.isCallExpression(p) && p.expression === id) return 'ALLOCATE_OR_OP';
  if (ts.isPropertyAccessExpression(p) && p.name === id) {
    const gp = gpArg;
    if (gp && ts.isCallExpression(gp) && gp.expression === p) return 'ALLOCATE_OR_OP';
    if (gp && ts.isBinaryExpression(gp) && gp.left === p &&
        gp.operatorToken.kind === ts.SyntaxKind.EqualsToken) return 'WRITE';
    return 'READ';
  }
  if ((ts.isPropertyAssignment(p) || ts.isShorthandPropertyAssignment(p)) && p.name === id) return 'FORWARD';
  if (ts.isVariableDeclaration(p) && p.name === id) return 'WRITE';
  if (ts.isParameter(p) && p.name === id) return 'DECLARE';
  if (ts.isBinaryExpression(p)) {
    const k = p.operatorToken.kind;
    if (k === ts.SyntaxKind.EqualsToken && p.left === id) return 'WRITE';
    if (k === ts.SyntaxKind.EqualsEqualsEqualsToken || k === ts.SyntaxKind.ExclamationEqualsEqualsToken ||
        k === ts.SyntaxKind.EqualsEqualsToken || k === ts.SyntaxKind.ExclamationEqualsToken) return 'COMPARE';
    return 'READ';
  }
  if (ts.isElementAccessExpression(p) && p.argumentExpression === id) return 'COMPARE';
  return 'READ';
}

const sites = [];
for (const sf of program.getSourceFiles()) {
  if (!files.includes(sf.fileName)) continue;
  const rel = sf.fileName.replace(`${ROOT}/packages/kernel/src/`, '');
  const stack = [];
  // ⚠️ inType is a PARAMETER of the walk, not a question asked afterwards.
  const visit = (n, inType, parent, grand) => {
    const nowType = inType ||
      ts.isTypeNode(n) || ts.isTypeAliasDeclaration(n) || ts.isInterfaceDeclaration(n) ||
      ts.isTypeParameterDeclaration(n) || ts.isIndexSignatureDeclaration(n) ||
      ts.isPropertySignature(n) || ts.isMethodSignature(n) ||
      (ts.isImportDeclaration(n) && !!n.importClause?.isTypeOnly);
    let pushed = false;
    if (ts.isFunctionDeclaration(n) || ts.isMethodDeclaration(n) || ts.isFunctionExpression(n) ||
        ts.isArrowFunction(n) || ts.isConstructorDeclaration(n) || ts.isGetAccessor(n) || ts.isSetAccessor(n)) {
      // ⚠️ ANONYMOUS FUNCTIONS DO NOT OPEN A SCOPE HERE. Pushing '(anon)'
      // collapsed 85 unrelated closures in entity-signal.ts into one bucket,
      // which is the same over-coarse grouping as the file-level version this
      // replaces. A callback is attributed to the nearest NAMED enclosing
      // function, which is the unit that actually has a semantic domain.
      let nm = null;
      if (n.name && ts.isIdentifier(n.name)) nm = n.name.text;
      else if (parent && ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) nm = parent.name.text;
      else if (parent && ts.isPropertyAssignment(parent) && ts.isIdentifier(parent.name)) nm = parent.name.text;
      else if (parent && ts.isPropertyDeclaration(parent) && parent.name && ts.isIdentifier(parent.name)) nm = parent.name.text;
      if (nm) { stack.push(nm); pushed = true; }
    }
    if (ts.isIdentifier(n) && NAMES.has(n.text) && !nowType) {
      sites.push({ file: rel, fn: stack[stack.length - 1] ?? '(top)', name: n.text,
        line: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1, role: roleOf(n, parent, grand) });
    }
    ts.forEachChild(n, (c) => visit(c, nowType, n, parent));
    if (pushed) stack.pop();
  };
  visit(sf, false, undefined, undefined);
}
writeFileSync(`${ROOT}/tools/subject-identity-census.json`, JSON.stringify(sites, null, 2));

/**
 * SEMANTIC FAMILIES, assigned per (file, enclosing named function).
 *
 * A file MAY contribute to several families — that is the whole reason this
 * replaced the file-level version. `entity-signal.ts` is the worked example:
 * its default domain is structural identity, but its reclamation entry points
 * belong to the retention family and its inspector to diagnostics.
 *
 * Every pair must match either an explicit `fns` entry or its file's `default`.
 * A file with neither leaves its pairs UNCLASSIFIED and the gate fails.
 */
const RULES = [
  { file: 'lib/entity-signal.ts', family: 'A entity structural identity',
    fns: null, default: true },
  { file: 'lib/entity-signal.ts', family: 'C restoration claim / reclamation',
    fns: ['planEntitySubjectReclamation', 'prepareSubjectReclamation',
          'applyPreparedSubjectReclamation', 'listSubjectReclamationCandidates',
          'reclaimRetiredSubjectsWithoutOwner', 'retireSubjectRetainedValueBackingForTesting',
          'planRestore', 'restoreOne', 'tombstoneSubjectSignal'] },
  { file: 'lib/entity-signal.ts', family: 'F diagnostics',
    fns: ['inspectSubjectResources'] },

  { file: 'lib/physical/structural-store.ts', family: 'A entity structural identity', default: true },
  { file: 'lib/physical/structural-store.ts', family: 'C restoration claim / reclamation',
    fns: ['forgetSubject', 'retireSubject', 'restoreSubject', 'restoreIndexForSubjects',
          'restoreSubjectAtResolvedPlacement', 'resolveSubjectRestorePlacement'] },
  { file: 'lib/physical/structural-store.ts', family: 'F diagnostics',
    fns: ['__assertActiveOrderIntegrityForTesting'] },

  { file: 'lib/physical/entity-mutation-frame.ts', family: 'A entity structural identity', default: true },
  { file: 'lib/physical/entity-value-store.ts', family: 'A entity structural identity', default: true },
  { file: 'lib/physical/entity-handle-resolution.ts', family: 'A entity structural identity', default: true },
  { file: 'lib/internals/entity-egress-projection.ts', family: 'A entity structural identity', default: true },
  { file: 'lib/internals/entity-projection-seed.ts', family: 'A entity structural identity', default: true },
  { file: 'lib/internals/source-mutation.ts', family: 'A entity structural identity', default: true },
  { file: 'lib/internals/materialize-markers.ts', family: 'A entity structural identity', default: true },

  { file: 'lib/path-notifier.ts', family: 'B notification / link routing', default: true },
  { file: 'lib/internals/path-observation-port.ts', family: 'B notification / link routing', default: true },
  { file: 'lib/link.ts', family: 'B notification / link routing', default: true },
  { file: 'lib/internals/intercept-leaf-signals.ts', family: 'B notification / link routing', default: true },
  { file: 'lib/internals/owned-metadata.ts', family: 'B notification / link routing', default: true },
  { file: 'lib/internals/owned-mutation.ts', family: 'B notification / link routing', default: true },
  { file: 'lib/mutation-types.ts', family: 'B notification / link routing', default: true },
  { file: 'lib/types.ts', family: 'B notification / link routing', default: true },

  { file: 'enhancers/restoration/restoration.ts', family: 'C restoration claim / reclamation', default: true },
  { file: 'lib/internals/subject-restoration-claims.ts', family: 'C restoration claim / reclamation', default: true },
  { file: 'lib/internals/subject-reclamation-sink.ts', family: 'C restoration claim / reclamation', default: true },
  { file: 'lib/internals/causal-runtime/subject-reclamation-coordinator.ts', family: 'C restoration claim / reclamation', default: true },
  { file: 'lib/internals/causal-runtime/reclamation-eligibility.ts', family: 'C restoration claim / reclamation', default: true },

  { file: 'enhancers/transactions/transactions.ts', family: 'D causal transaction / rollback', default: true },
  { file: 'lib/internals/causal-runtime/transaction-capture-bridge.ts', family: 'D causal transaction / rollback', default: true },
  { file: 'lib/internals/causal-runtime/pending-rollback.ts', family: 'D causal transaction / rollback', default: true },
  { file: 'lib/internals/causal-runtime/greenfield-transactions.ts', family: 'D causal transaction / rollback', default: true },
  { file: 'lib/internals/causal-runtime/confirmed-undo.ts', family: 'D causal transaction / rollback', default: true },
  { file: 'lib/internals/causal-runtime/pending-confirmation.ts', family: 'D causal transaction / rollback', default: true },
  { file: 'lib/internals/causal-runtime/causal-types.ts', family: 'D causal transaction / rollback', default: true },
  { file: 'lib/internals/causal-runtime/reversal-planner.ts', family: 'D causal transaction / rollback', default: true },

  { file: 'lib/internals/causal-runtime/tree-realization-adapter.ts', family: 'E realization / replay', default: true },
  { file: 'lib/internals/causal-runtime/reapply-planner.ts', family: 'E realization / replay', default: true },

  { file: 'lib/internals/diagnostics/diagnostic-journal.ts', family: 'F diagnostics', default: true },
];

function familyFor(site) {
  const forFile = RULES.filter((r) => r.file === site.file);
  const explicit = forFile.find((r) => Array.isArray(r.fns) && r.fns.includes(site.fn));
  if (explicit) return explicit.family;
  const dflt = forFile.find((r) => r.default);
  return dflt ? dflt.family : null;
}

const famTally = new Map();
const unclassified = [];
for (const s of sites) {
  const f = familyFor(s);
  if (!f) { unclassified.push(`${s.file}::${s.fn}`); continue; }
  famTally.set(f, (famTally.get(f) ?? 0) + 1);
}

const roles = new Map();
for (const s of sites) roles.set(s.role, (roles.get(s.role) ?? 0) + 1);
console.log(`VALUE-LEVEL SITES: ${sites.length}   (type positions excluded by downward inType)\n`);
console.log('BY ROLE');
for (const [r, n] of [...roles].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)}  ${r}`);
const pairs = new Map();
for (const s of sites) { const k = `${s.file}::${s.fn}`; pairs.set(k, (pairs.get(k) ?? 0) + 1); }
console.log(`\nDISTINCT (file, enclosing fn) PAIRS: ${pairs.size}`);
if (process.argv.includes('--pairs')) for (const [k, n] of [...pairs].sort((a,b)=>b[1]-a[1])) console.log(`  ${String(n).padStart(4)}  ${k}`);

console.log('\nFAMILY ACCOUNTING  (per file+function, not per file)');
let sum = 0;
for (const [f, n] of [...famTally].sort()) { sum += n; console.log(`  ${String(n).padStart(4)}  ${f}`); }
const contributors = new Map();
for (const s of sites) { const f = familyFor(s); if (f) (contributors.get(s.file) ?? contributors.set(s.file, new Set()).get(s.file)).add(f); }
const split = [...contributors].filter(([, fs]) => fs.size > 1);
console.log(`\n  FILES CONTRIBUTING TO >1 FAMILY: ${split.length}`);
for (const [f, fs] of split) console.log(`    ${f} -> ${[...fs].map((x) => x[0]).sort().join(', ')}`);
console.log(`\n  VALUE-LEVEL SITES  ${sites.length}`);
console.log(`  ACCOUNTED          ${sum}`);
console.log(`  UNCLASSIFIED       ${new Set(unclassified).size}`);
for (const u of new Set(unclassified)) console.log(`    ${u}`);
if (sum !== sites.length || unclassified.length) { console.error('\n❌ family accounting incomplete.'); process.exit(1); }
console.log('\n✅ every value-level subject-identity site belongs to exactly one family.');
