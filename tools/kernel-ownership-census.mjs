#!/usr/bin/env node
/**
 * KERNEL-OWNERSHIP-INVENTORY-0 — mechanical census of every production-reachable
 * subject in @signal-tree/kernel, emitted as JSON for classification.
 *
 * ⚠️ THIS MUST BE GENERATED, NEVER HAND-MAINTAINED. The reason this phase exists
 * is that a conceptual inventory assembled from whatever we happened to
 * investigate let `batchUpdates` slip: the notifier split moved delivery out of
 * bare with 55/55 gates green, and nobody noticed the same class had also
 * carried producer-owned CONFIGURATION until the ordering was probed by hand.
 * A list you write from memory cannot report what you forgot to think about.
 *
 * The census answers "what EXISTS". It deliberately assigns no dispositions —
 * those live in the checked-in ledger, and `check-kernel-ownership.mjs` fails
 * when the two disagree.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { execSync } from 'node:child_process';
// ⚠️ THE CENSUS USES THE PROVEN DETECTORS. Keeping a private copy here would mean
// the controls prove a duplicate while the census runs something else — the same
// parallel-source-of-truth mistake the checker already made once.
import { productionSourceFiles } from './module-state-evidence.mjs';
import {
  detectPublicValueExports,
  detectPublicTypeExports,
  detectInterfaceFields,
  detectCapabilities,
  detectMarkerRegistration,
  detectPipelineFns,
  detectStructuralSymbols,
  detectAngularImports,
  detectExportedFns,
  OBSERVERS,
  NEGATIVE,
  FAMILIES,
  detectTopLevelBindings,
  detectSubpathExports,
  detectMarkerFactoryPaths,
} from './census-detectors.mjs';

if (process.argv.includes('--self-test')) {
  let bad = 0;
  for (const [name, run, anchor] of OBSERVERS) {
    const ok = run().includes(anchor);
    if (!ok) bad++;
    console.log(`  ${ok ? 'pass' : 'FAIL'}  positive  ${name} -> ${anchor}`);
  }
  for (const [name, run, forbidden] of NEGATIVE) {
    const ok = !run().includes(forbidden);
    if (!ok) bad++;
    console.log(`  ${ok ? 'pass' : 'FAIL'}  negative  ${name}`);
  }
  // ⚠️ BARE REACHABILITY IS NOT A SOURCE-TEXT DETECTOR, so it cannot have a
  // planted fixture. It gets the control its evidence actually admits: the bare
  // module list must CONTAIN a module known to be reachable and must NOT contain
  // one known to be excluded. One direction alone is vacuous — an empty list
  // passes "does not contain entity-signal".
  try {
    const here = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
    const mods = JSON.parse(
      execSync(`node ${here}/tools/bare-module-list.mjs`, { encoding: 'utf8' })
    ).map((m) => m.module);
    const mustHave = mods.includes('signal-tree.js');
    const mustLack = !mods.includes('entity-signal.js');
    if (!mustHave) bad++;
    if (!mustLack) bad++;
    console.log(`  ${mustHave ? 'pass' : 'FAIL'}  positive  bareReachability:includes signal-tree.js`);
    console.log(`  ${mustLack ? 'pass' : 'FAIL'}  negative  bareReachability:excludes entity-signal.js`);
  } catch (err) {
    bad++;
    console.log(`  FAIL  bareReachability control could not run: ${err.message}`);
  }

  console.log(
    bad
      ? `\n❌ ${bad} observer control(s) failed — the detectors cannot see what the census claims to find.`
      : `\n✅ ${OBSERVERS.length + 1} positive and ${NEGATIVE.length + 1} negative observer controls pass across ${FAMILIES.length + 1} discovery families.`
  );
  process.exit(bad ? 1 : 0);
}

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const CORE = `${ROOT}/packages/kernel/src`;

function walk(dir, out = [], includeSpecs = false) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, out, includeSpecs);
    else if (p.endsWith('.ts') && (includeSpecs || !p.includes('.spec.'))) out.push(p);
  }
  return out;
}
// ⚠️ THE PRODUCTION COMPILATION'S OWN INPUTS, not a directory walk. A walk
// included `src/test-setup.ts`, which tsconfig excludes — so both instruments
// could have agreed about a subject that is not compiled into the package.
// COMPILER-OPTION PARITY IS NOT PROJECT-INPUT PARITY.
const FILES = productionSourceFiles();
const rel = (p) => relative(ROOT, p);
const read = (p) => readFileSync(p, 'utf8');

const census = {};

// ── 1. PUBLIC SURFACE ────────────────────────────────────────────────────────
// ⚠️ STRIP COMMENTS FIRST. The barrel is heavily annotated, and comment text
// INSIDE an `export { ... }` block was being extracted as export names — the
// gate caught four bogus "subjects" made of prose, and mangled the real
// `asReadonly`. A census whose parser invents subjects cannot certify anything.
// ⚠️ LINE COMMENTS FIRST, AND THIS ORDER IS LOAD-BEARING. Stripping block
// comments first swallowed 1,063 characters of `mutation-types.ts` — including
// the whole `MutationEnvelope` declaration — because a LINE comment mentioning
// `packages/*/src/**` opened a block match that ran to the next `*/`. The
// inventory came back empty rather than wrong, which is the only reason it was
// noticed; the same helper parses the barrel, so it could have been silently
// dropping public exports instead.
// `stripComments` now lives in ./census-detectors.mjs, where it is proven.

/**
 * A parser that returns nothing looks identical to a subject that does not
 * exist, so every inventory that can come back empty needs a control. The
 * question is WHAT the control may be anchored to.
 *
 *     A DISCOVERY CONTROL MUST TEST THE DETECTOR, NOT THE SURVIVAL OF A
 *     PRODUCTION SUBJECT.
 *
 * ⚠️ THIS USED TO BE `mustFind(label, value, anchor)`, asserting that a named
 * production subject appeared in the results — and it misfired TWICE in two
 * passes, each time announcing "the parser is broken, not the repository" about
 * a parser that was fine:
 *
 *     batchUpdates                 retired by BATCH-UPDATES-INTENT-0
 *     mutationEnvelope.positionId  retired by ME-B
 *
 * Both were successful convergence work. A census whose self-check is pinned to
 * a subject under audit reports its own success as tool failure, and since a
 * convergence audit deletes subjects BY DESIGN, every such anchor is a
 * scheduled false alarm rather than bad luck.
 *
 * Detector CORRECTNESS is proven where it belongs: `census-detectors.mjs`
 * declares every discovery family with planted positives, planted negatives and
 * a killing mutation, and `census-mutation-proof.mjs` — run by
 * `check-kernel-ownership` — proves each family's detector actually dies when
 * mutated. Those fixtures contain no production subject and survive any
 * deletion this audit can make.
 *
 * What remains here is the one thing fixtures cannot see: whether a detector
 * that works on a fixture returned nothing against the REAL tree. That check
 * names no subject — it asserts only that a live category is non-empty. If a
 * category legitimately empties, retire the CATEGORY (as `mutationEnvelopeFields`
 * was), rather than repointing an anchor at another field of a dying interface.
 */
function mustDiscoverSomething(label, value) {
  const n = Array.isArray(value) ? value.length : value ? 1 : 0;
  if (n === 0) {
    console.error(
      `\n❌ census self-check failed: ${label} discovered NOTHING against the` +
        ` real source tree.\n   Detector correctness is fixture-proven in` +
        ` census-detectors.mjs, so this is either a parser that silently stopped` +
        ` matching real input, or a category that no longer exists.\n   If the` +
        ` category is genuinely retired, DELETE the category — do not re-anchor it.`
    );
    process.exit(1);
  }
}
const rawBarrel = read(`${CORE}/index.ts`);
const publicValues = detectPublicValueExports(rawBarrel);
const publicTypes = detectPublicTypeExports(rawBarrel);
census.publicSurface = {
  rootValueExports: [...new Set(publicValues)].sort(),
  rootTypeExports: [...new Set(publicTypes)].sort(),
  subpathExports: detectSubpathExports(readFileSync(`${ROOT}/packages/kernel/package.json`, 'utf8')),
};

mustDiscoverSomething('publicSurface.rootValueExports', [...new Set(publicValues)]);

// ── 2. CONSTRUCTION SURFACE ──────────────────────────────────────────────────
census.constructionSurface = {
  treeConfigFields: detectInterfaceFields(read(`${CORE}/lib/types.ts`), 'TreeConfig'),
  capabilities: [...new Set(FILES.flatMap((f) => detectCapabilities(read(f))))].sort(),
  markerFactories: detectMarkerFactoryPaths(FILES).map(rel),
  markerRegistrations: FILES.filter((f) => detectMarkerRegistration(read(f))).map(rel),
};

// ── 4b. MUTATION ENVELOPE FIELDS — CATEGORY RETIRED IN 15.0 ─────────────────
// `MutationEnvelope` was deleted by ME-B (MUTATION-ENVELOPE-OWNERSHIP-0): a
// one-producer, one-consumer object that only transcoded into the already
// authoritative `notify(...)` protocol. Its fields are no longer subjects
// because the subject they belonged to does not exist. Their dispositions are
// recorded in architecture history, not carried as live ledger rows.
//
// ⚠️ THIS CATEGORY'S ANCHOR FAILED THE SAME WAY `batchUpdates` DID, one pass
// later — `mustFind(..., 'positionId')` reported "the parser is broken, not the
// repository" when the parser was fine and the interface was simply gone. Twice
// in two passes is not a coincidence, it is the shape of the mistake:
//
//     A KNOWN-PRESENT ANCHOR MUST NAME SOMETHING THE AUDIT IS NOT TRYING TO
//     DELETE, OR SUCCESSFUL CLEANUP REPORTS ITSELF AS TOOL FAILURE.
//
// A convergence audit deletes subjects by design, so any anchor pinned to a
// subject under disposition is a scheduled false alarm. Anchor on load-bearing
// surface instead — and when a whole category is retired, retire its anchor
// WITH it rather than repointing to another field of a dying interface.
mustDiscoverSomething('treeConfigFields', census.constructionSurface.treeConfigFields);

// ── 3. RUNTIME SINGLETON / MODULE STATE ──────────────────────────────────────
// Module-level mutable state is the class of thing that carries hidden
// authority — exactly where `batchUpdates` was lost.
// ⚠️ EVERY TOP-LEVEL BINDING IS A SUBJECT. An earlier version auto-declined the
// 16 `const`s bound to literal primitives, reasoning: immutable, therefore no
// changing authority, therefore not a subject. The first two steps are sound and
// the third does not follow.
//
//     IMMUTABILITY PROVES ABSENCE OF MUTABLE STATE; IT DOES NOT PROVE ABSENCE OF
//     SEMANTIC AUTHORITY.
//
//     const DEFAULT_BATCHING = true;
//     const MAX_HISTORY = 50;
//     const FLUSH_DELAY_MS = 0;
//
// None is mutable. Every one makes an architectural decision. Syntax does not
// get to rule a fact irrelevant — that is the same move as "bare reachable
// therefore KERNEL", which this census already had to unlearn.
//
// So all 126 are retained and merely ANNOTATED. `MODULE-STATE-OWNERSHIP-0` may
// prioritise the 110 mutable/reference-capable candidates; the 16 constants
// still owe an ownership disposition, under MODULE-CONSTANT-POLICY-0.
const bindings = [];
for (const f of FILES)
  for (const b of detectTopLevelBindings(read(f), f))
    bindings.push({
      file: rel(f),
      ...b,
      mutableCandidate: !b.immutablePrimitive,
    });
census.runtimeState = bindings;

// ── 4/5. MUTATION + OBSERVATION PIPELINE ─────────────────────────────────────
census.exportedPipelineCandidates = FILES.flatMap((f) =>
  detectPipelineFns(read(f)).map((fn) => ({ file: rel(f), fn }))
);

// ── 6. STRUCTURAL SYSTEMS — every SignalTree: symbol is a structural contract ─
census.structuralSymbols = [
  ...new Set(FILES.flatMap((f) => detectStructuralSymbols(read(f)))),
].sort();

// ── 8. FRAMEWORK DEPENDENCIES ────────────────────────────────────────────────
//
// ⚠️ CLASSIFIED BY VALUE-POSITION USE, NOT BY IMPORT STATEMENT KIND.
//
//     IMPORT STATEMENT KIND DOES NOT ESTABLISH RUNTIME COUPLING.
//     VALUE-POSITION USE DOES.
//
//     TYPE ERASURE IS A PROPERTY OF THE REFERENCED SYMBOL'S USE, NOT OF THE
//     IMPORT STATEMENT THAT HAPPENS TO CONTAIN IT.
//
// `import { signal, Signal } from '@angular/core'` carries one runtime symbol
// and one erased type. Reading `typeOnly` off the statement marked
// `lib/types.ts`, `internals/builder-types.ts` and `internals/derived-types.ts`
// as runtime-coupled — three C6 REIMPLEMENT actions for work that does not
// exist. The emitted JS confirms it: none of the three imports @angular/core,
// and builder-types is not emitted at all.
census.angularImports = FILES.flatMap((f) =>
  detectAngularImports(read(f)).map((a) => ({ file: rel(f), ...a }))
);
const angularUse = JSON.parse(
  execSync(`node ${ROOT}/tools/angular-service-census.mjs --json`, { encoding: 'utf8' })
);

// ── 10. INTERNAL EXPORTS WITH NO PRODUCTION CONSUMER ─────────────────────────
// ⚠️ "NO PRODUCTION CONSUMER" IS TWO DIFFERENT ANSWERS, and collapsing them
// makes 40-odd rows undecidable that are mechanically decidable. A symbol reached
// only by specs is a TEST SEAM — deliberate, and deleting it breaks a carrier. A
// symbol reached by NOTHING is dead. The census must separate them so the ledger
// only has to rule on what evidence cannot settle.
const SPEC_FILES = walk(CORE, [], true).filter((p) => p.includes('.spec.'));
const allSrc = FILES.map((f) => ({ f, src: read(f) }));
const specSrc = SPEC_FILES.map((f) => read(f));
const internalExports = [];
for (const { f, src } of allSrc) {
  if (f.endsWith('/index.ts')) continue;
  for (const name of detectExportedFns(src)) {
    if (publicValues.includes(name)) continue;
    const re = new RegExp(`\\b${name}\\b`);
    const prod = allSrc.filter(({ f: g, src: s }) => g !== f && re.test(s)).length;
    if (prod > 0) continue;
    const specs = specSrc.filter((s) => re.test(s)).length;
    // ⚠️ AND "NOTHING ELSE IMPORTS IT" IS STILL NOT "DEAD". Three of these turned
    // out to be called inside their own file (the export is merely unnecessary),
    // two are attached to a testing-hooks object, and exactly ONE was reachable
    // only from a JSDoc `{@link}` — the single genuinely dead export in the
    // package. Collapsing those into one bucket would have proposed deleting
    // live code.
    const callsHere = [
      ...src.matchAll(new RegExp(`\\b${name}\\b`, 'g')),
    ].length;
    const declaredOnce = 1;
    const referencedInFile = callsHere - declaredOnce;
    const docOnly =
      referencedInFile > 0 &&
      new RegExp(`\\{@link\\s+${name}\\b`).test(src) &&
      !new RegExp(`(?<!\\* )\\b${name}\\s*\\(`).test(
        src.replace(new RegExp(`export (?:async )?function ${name}\\s*\\(`), '')
      );
    internalExports.push({
      file: rel(f),
      fn: name,
      specConsumers: specs,
      referencedInFile,
      reachedBy:
        specs > 0
          ? 'specs-only'
          : docOnly
            ? 'doc-comment-only'
            : referencedInFile > 0
              ? 'same-file-only'
              : 'nothing',
    });
  }
}
census.internalExportsWithoutProductionConsumer = internalExports;

// ── 9. BUNDLE REACHABILITY (from the built artifact) ─────────────────────────
try {
  const out = execSync(`node ${ROOT}/tools/bare-module-list.mjs`, { encoding: 'utf8' });
  census.bareReachableModules = JSON.parse(out);
} catch {
  census.bareReachableModules = null; // reported, never silently omitted
}

// ── SUBJECT EMISSION ────────────────────────────────────────────────────────
//
// ⚠️ THE CENSUS EMITS ITS OWN SUBJECT LIST. The first version left the checker to
// rebuild the set from a parallel hand-written list, and it silently omitted TWO
// WHOLE CATEGORIES (`runtimeState`, `pipelines`) plus 43 public type exports and
// 6 marker factories — 74 subjects discovered and never gated.
//
//     A CENSUS THAT DISCOVERS A SUBJECT BUT DOES NOT GATE IT HAS NOT CLOSED
//     THAT SUBJECT.
//
// Every category must now resolve to either SUBJECTS or a declared NON-SUBJECT
// with a stated reason, and `assertEveryCategoryAccounted` fails if a category
// is added later and reaches neither.
const subjects = [];
const nonSubjects = [];
const emit = (category, key, facts = {}) =>
  subjects.push({ category, key, ...facts });
const declineCategory = (category, count, reason) =>
  nonSubjects.push({ category, count, reason });

for (const n of census.publicSurface.rootValueExports) emit('publicValue', `public:${n}`);
for (const n of census.publicSurface.rootTypeExports) emit('publicType', `public-type:${n}`);
for (const n of census.publicSurface.subpathExports) emit('subpath', `subpath:${n}`);
for (const n of census.constructionSurface.treeConfigFields) emit('config', `config:${n}`);
for (const n of census.constructionSurface.capabilities) emit('capability', `capability:${n}`);
for (const f of census.constructionSurface.markerFactories) emit('markerFactory', `marker-factory:${f.replace('packages/kernel/src/', '')}`);
for (const f of census.constructionSurface.markerRegistrations) emit('markerRegistration', `marker-registration:${f.replace('packages/kernel/src/', '')}`);
for (const s2 of census.runtimeState)
  emit('moduleState', `state:${s2.file.replace('packages/kernel/src/', '')}:${s2.name}`, { init: s2.init });
for (const p2 of census.exportedPipelineCandidates)
  emit('exportedPipelineCandidate', `pipeline-candidate:${p2.file.replace('packages/kernel/src/', '')}:${p2.fn}`);
for (const n of census.structuralSymbols) emit('structuralSymbol', `symbol:${n}`);
// ⚠️ MERGE PER FILE. `signal-tree.ts` has two separate `@angular/core` import
// statements, which emitted the same subject key twice — the ledger carried 256
// rows for 255 subjects. A duplicate key is silently deduped by the gate, so one
// of the two rulings would never have been read.
const angularByFile = new Map();
for (const [f, use] of Object.entries(angularUse)) {
  const runtime = use.value.length > 0;
  angularByFile.set(`${runtime ? 'angular-value' : 'angular-type'}:${f}`, {
    typeOnly: !runtime,
    symbols: runtime ? use.value : use.type,
  });
}
for (const [key, v] of angularByFile)
  emit(v.typeOnly ? 'angularTypeImport' : 'angularValueImport', key, { symbols: v.symbols });
for (const e of census.internalExportsWithoutProductionConsumer)
  emit('orphanExport', `orphan:${e.file.replace('packages/kernel/src/', '')}:${e.fn}`, { reachedBy: e.reachedBy });
// ⚠️ KEYED BY NORMALIZED SOURCE PATH, not basename. Two different source files
// can compile to the same chunk basename (`constants.js`, `index.js` both did),
// so a basename key cannot address a subject.
for (const m of census.bareReachableModules)
  emit('bareModule', `bare-module:${m.subject ?? m.module}`, { bytes: m.bytes });

// Nothing is declined today. The mechanism exists so a future category cannot
// be dropped by omission — it has to be refused ON THE RECORD.
// Nothing is declined. The mechanism stays so that a future refusal has to be
// made ON THE RECORD rather than by omission.
declineCategory('(none)', 0, 'no category is currently excluded from gating');

const CATEGORIES = [
  'publicSurface.rootValueExports', 'publicSurface.rootTypeExports',
  'publicSurface.subpathExports', 'constructionSurface.treeConfigFields',
  'constructionSurface.capabilities', 'constructionSurface.markerFactories',
  'constructionSurface.markerRegistrations',
  'runtimeState', 'pipelines', 'structuralSymbols', 'angularImports',
  'internalExportsWithoutProductionConsumer', 'bareReachableModules',
];
function assertEveryCategoryAccounted() {
  const emitted = {
    'publicSurface.rootValueExports': census.publicSurface.rootValueExports.length,
    'publicSurface.rootTypeExports': census.publicSurface.rootTypeExports.length,
    'publicSurface.subpathExports': census.publicSurface.subpathExports.length,
    'constructionSurface.treeConfigFields': census.constructionSurface.treeConfigFields.length,
    'constructionSurface.capabilities': census.constructionSurface.capabilities.length,
    'constructionSurface.markerFactories': census.constructionSurface.markerFactories.length,
    'constructionSurface.markerRegistrations': census.constructionSurface.markerRegistrations.length,
    runtimeState: census.runtimeState.length,
    exportedPipelineCandidates: census.exportedPipelineCandidates.length,
    structuralSymbols: census.structuralSymbols.length,
    angularImports: angularByFile.size, // merged per file, see above
    internalExportsWithoutProductionConsumer: census.internalExportsWithoutProductionConsumer.length,
    bareReachableModules: census.bareReachableModules.length,
  };
  const total = Object.values(emitted).reduce((a, b) => a + b, 0);
  const declined = nonSubjects.reduce((a, b) => a + b.count, 0);
  if (subjects.length + declined !== total) {
    console.error(
      `\n❌ census self-check failed: ${total} discovered across ${CATEGORIES.length}` +
        ` categories, but ${subjects.length} emitted + ${declined} declined.` +
        ' Some discovered subject reaches neither the gate nor a declared refusal.'
    );
    process.exit(1);
  }
}
assertEveryCategoryAccounted();
census.subjects = subjects;
census.nonSubjects = nonSubjects;

const counts = Object.fromEntries(
  Object.entries(census).map(([k, v]) => [
    k,
    Array.isArray(v) ? v.length : v && typeof v === 'object' ? Object.values(v).flat().length : 0,
  ])
);
writeFileSync(`${ROOT}/tools/kernel-ownership-census.json`, JSON.stringify(census, null, 2));
console.log('KERNEL-OWNERSHIP-INVENTORY-0 census');
for (const [k, n] of Object.entries(counts)) console.log(`  ${String(n).padStart(4)}  ${k}`);
