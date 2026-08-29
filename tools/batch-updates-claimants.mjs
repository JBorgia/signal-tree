#!/usr/bin/env node
/**
 * BATCH-UPDATES-SURVIVAL-0.2 — occurrence ledger for `batchUpdates`.
 *
 *     DISCOVERY MAY OVER-INCLUDE; CLASSIFICATION MAY NARROW.
 *     SAME FILE DOES NOT IMPLY SAME SEMANTIC DOMAIN.
 *
 * Discovery is an exact-token AST sweep over every first-party `.ts` on disk.
 * Disposition is a RULING recorded per occurrence in `BATCH_UPDATES_LEDGER`,
 * with evidence. The tool proves parity and refuses UNKNOWN; it does not infer
 * dispositions.
 *
 * ⚠️ THE PREVIOUS CLASSIFIER MANUFACTURED ITS OWN ZERO. It called ANY
 * `PropertySignature` named `batchUpdates` a "declaration (TreeConfig)", then
 * reclassified every authored occurrence in that file as unrelated. So:
 *
 *     interface Metrics { batchUpdates: number }        // in the same file
 *     signalTree(state, { batchUpdates: false });       // a GENUINE claimant
 *
 * would have been discarded on the strength of sharing a file with an unrelated
 * declaration. It also printed its category table BEFORE reclassification, so
 * the published run showed `AUTHORED OPTION: 1` above `CLAIMANTS: 0` — two
 * classification states in one report.
 */
import ts from 'typescript';
import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const rel = (p) => relative(ROOT, p);
const TOKEN = 'batchUpdates';

const DISPOSITIONS = new Set([
  'TREECONFIG_DECLARATION',
  'IMPLEMENTATION',
  'FIRST_PARTY_CLAIMANT',
  'TEST',
  'RECORDED_DATA',
  'GENERATED_COPY',
  'UNRELATED_SYMBOL',
  'AUDIT_TOOLING',
  'UNKNOWN',
]);

/**
 * THE RULINGS. One row per discovered occurrence, keyed `file:line`. Every
 * dismissal is explicit and carries its reason — no occurrence is dismissed by
 * a rule that also dismisses its neighbours.
 */
// ⚠️ SIX ROWS WERE REMOVED WHEN THE OPTION WAS RETIRED, and the gate refused
// until they were — a ledger that outlives its subjects starts certifying code
// that is not there. Removed: the TreeConfig declaration, its writer, three
// carriers written for it, and the generated `dist-core` typing, which
// regenerated to match on the next build (confirming it tracks core rather than
// being the static snapshot my evidence note called it).
//
// What survives is entirely outside the packages: recorded LLM output and one
// unrelated metrics counter.
const BATCH_UPDATES_LEDGER = {
            'scripts/ai-codegen-benchmark/results/run-2026-05-29-primed-llms-myths/raw/006-undo-redo.signaltree.haiku.ts:20':
    [
      'RECORDED_DATA',
      'immutable captured output of an LLM under benchmark; also calls `.with()`, deleted in 15.0. Not maintained code. IS evidence that models trained on the docs emit this option.',
    ],
  'scripts/ai-codegen-benchmark/results/run-2026-05-29-primed-llms-myths/raw/006-undo-redo.ngrx-signals.haiku.ts:18':
    ['RECORDED_DATA', 'same benchmark run, ngrx-signals arm'],
  'scripts/ai-codegen-benchmark/results/run-2026-05-29-primed-llms-myths/raw/006-undo-redo.ngrx-store.haiku.ts:18':
    ['RECORDED_DATA', 'same benchmark run, ngrx-store arm'],
    'scripts/performance/recursive-metrics.ts:81': [
    'UNRELATED_SYMBOL',
    'declares its OWN `interface { operations: { batchUpdates: number } }` — an operation COUNTER. Ruled unrelated on its own evidence (numeric counter in a locally declared metrics shape), NOT because of the file it lives in.',
  ],
  'scripts/performance/recursive-metrics.ts:109': [
    'UNRELATED_SYMBOL',
    'initialises that same counter to 0. Its contextual type is the local metrics interface, not TreeConfig.',
  ],
};

const SKIP_DIRS = new Set([
  'node_modules', 'dist', '.git', '.nx', '.cache', '.angular', 'coverage', 'tmp',
]);
function allFirstPartyTs(dir = ROOT, out = []) {
  for (const e of readdirSync(dir)) {
    if (SKIP_DIRS.has(e) || e.startsWith('.nx')) continue;
    const p = join(dir, e);
    let st;
    try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) allFirstPartyTs(p, out);
    else if (/\.tsx?$/.test(p)) out.push(p);
  }
  return out;
}

/** Discovery only: exact token as identifier or string literal. */
export function discoverOccurrences(files) {
  const found = [];
  for (const file of files) {
    const src = readFileSync(file, 'utf8');
    if (!src.includes(TOKEN)) continue;
    const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true);
    const visit = (n) => {
      if ((ts.isIdentifier(n) && n.text === TOKEN) || (ts.isStringLiteral(n) && n.text === TOKEN))
        found.push({
          file,
          line: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1,
          context: ts.SyntaxKind[n.parent.kind],
        });
      ts.forEachChild(n, visit);
    };
    ts.forEachChild(sf, visit);
  }
  return found;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const files = allFirstPartyTs();
  const occurrences = discoverOccurrences(files).map((o) => ({
    ...o,
    key: `${rel(o.file)}:${o.line}`,
  }));
  // audit tooling is discovered then dismissed by ORIGIN, which is a property of
  // the occurrence itself, not of a file it happens to share.
  const auditable = occurrences.filter((o) => !o.key.startsWith('tools/'));

  const discovered = new Set(auditable.map((o) => o.key));
  const ledger = new Set(Object.keys(BATCH_UPDATES_LEDGER));
  const unclassified = [...discovered].filter((k) => !ledger.has(k)).sort();
  const stale = [...ledger].filter((k) => !discovered.has(k)).sort();
  const unknown = Object.entries(BATCH_UPDATES_LEDGER)
    .filter(([, [d]]) => d === 'UNKNOWN')
    .map(([k]) => k);
  for (const [k, [d]] of Object.entries(BATCH_UPDATES_LEDGER))
    if (!DISPOSITIONS.has(d)) {
      console.error(`❌ invalid disposition "${d}" for ${k}`);
      process.exit(1);
    }

  console.log(`first-party .ts scanned: ${files.length}`);
  console.log(`occurrences discovered:  ${occurrences.length} (${occurrences.length - auditable.length} in audit tooling)`);
  console.log(`ledger rows:             ${ledger.size}\n`);

  // ⚠️ REPORTED AFTER FINAL CLASSIFICATION. The previous run printed its
  // category table before reclassifying, so the totals contradicted each other.
  const byDisp = {};
  for (const o of auditable) {
    const [d, why] = BATCH_UPDATES_LEDGER[o.key] ?? ['UNKNOWN', '(no ruling)'];
    (byDisp[d] ??= []).push({ ...o, why });
  }
  for (const [d, list] of Object.entries(byDisp).sort((a, b) => b[1].length - a[1].length)) {
    console.log(`${d}: ${list.length}`);
    for (const o of list) console.log(`    ${o.key}  [${o.context}]\n        ${o.why}`);
  }

  let bad = 0;
  const show = (label, list) => {
    if (!list.length) return;
    bad++;
    console.log(`\n❌ ${label} (${list.length})`);
    for (const k of list) console.log(`      ${k}`);
  };
  show('DISCOVERED but unclassified', unclassified);
  show('CLASSIFIED but no longer discovered', stale);
  show('UNKNOWN disposition', unknown);

  const claimants = (byDisp['FIRST_PARTY_CLAIMANT'] ?? []).length;
  console.log(`\nFIRST_PARTY_CLAIMANT: ${claimants}`);
  if (bad) {
    console.error('\n❌ occurrence ledger is not closed.');
    process.exit(1);
  }
  console.log('✅ every discovered occurrence has an explicit ruling; none UNKNOWN.');
}
