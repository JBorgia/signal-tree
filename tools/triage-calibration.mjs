#!/usr/bin/env node
/**
 * Calibration for the module-state triage score.
 *
 *     TRIAGE MAY OVER-ESCALATE. IT MUST NOT SILENTLY UNDER-ESCALATE KNOWN RISK
 *     SHAPES.
 *
 * ⚠️ THE SCORER'S TWO OBSERVED FAILURES WERE FALSE POSITIVES — a pure helper and
 * a `Symbol.for()` key both reached DEEP. Those cost time and miss nothing. The
 * dangerous direction is the other one, and it is invisible: a known-dangerous
 * shape quietly landing in FAST-LANE and closing on an evidence row.
 *
 * So the fix for a false positive is NEVER another lexical exception added
 * until the noise goes away — that is how a triage tool becomes gradually more
 * permissive. These controls pin both directions using subjects whose real
 * disposition this audit already established.
 */
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
execSync(`node ${ROOT}/tools/module-state-evidence.mjs`, { stdio: 'pipe' });
const rows = JSON.parse(readFileSync(`${ROOT}/tools/module-state-evidence.json`, 'utf8'));
const by = new Map(rows.map((r) => [`${r.file}::${r.name}`, r]));

/** Subjects whose investigation produced a real finding, or that hold live authority. */
const MUST_ESCALATE = [
  ['lib/internals/path-observation-port.ts::runtime', 'the reset-divergence defect'],
  ['lib/path-notifier.ts::globalPathNotifier', 'the other half of that pair'],
  ['lib/internals/materialization-realization.ts::installed', 'framework installation authority'],
  ['lib/internals/materialize-markers.ts::applyMemberValue', 'installed cycle seam'],
  ['lib/internals/production-substrate-stats.ts::activeStats', 'resembled batchDepth until traced'],
  ['lib/utils.ts::MATERIALIZED', 'cache whose correctness is invalidation'],
  ['lib/internals/materialize-markers.ts::MARKER_PROCESSORS', 'monotonic capability registry'],
];

/** Inert shapes that must not reach DEEP on lexical grounds alone. */
const MUST_NOT_DEEP = [
  ['lib/internals/subject-restoration-claims.ts::SUBJECT_RESTORATION_CLAIMS_SYMBOL', 'Symbol.for() key'],
  ['lib/internals/acquire-projection.ts::isRealizableSubject', 'const pure helper'],
  ['lib/internals/tree-capabilities.ts::TREE_CAPABILITY_ORDER', 'immutable table'],
];

let bad = 0;
console.log('must ESCALATE (never FAST-LANE):');
for (const [key, why] of MUST_ESCALATE) {
  const r = by.get(key);
  if (!r) { console.log(`  skip  ${key} — no longer a subject (deleted?)`); continue; }
  const ok = r.lane !== 'FAST-LANE';
  if (!ok) bad++;
  console.log(`  ${ok ? 'pass' : 'FAIL'}  ${r.lane.padEnd(12)} ${key.split('::')[1].padEnd(22)} ${why}`);
}
console.log('\nmust NOT be DEEP on lexical grounds:');
for (const [key, why] of MUST_NOT_DEEP) {
  const r = by.get(key);
  if (!r) { console.log(`  skip  ${key} — no longer a subject`); continue; }
  const ok = r.lane !== 'DEEP';
  if (!ok) bad++;
  console.log(`  ${ok ? 'pass' : 'FAIL'}  ${r.lane.padEnd(12)} ${key.split('::')[1].padEnd(38)} ${why}`);
}
console.log(bad ? `\n❌ ${bad} calibration control(s) failed.` : '\n✅ triage calibration holds in both directions.');
process.exit(bad ? 1 : 0);
