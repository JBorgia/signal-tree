#!/usr/bin/env node
/**
 * KERNEL-OWNERSHIP-INVENTORY-0 gate.
 *
 * Every production-reachable subject the census finds must carry a disposition
 * in `docs/architecture/kernel-ownership-ledger.md`. The gate fails on:
 *
 *   MISSING   a censused subject with no ledger row      -> the strip is unsafe
 *   UNKNOWN   a row whose disposition is not yet decided -> the strip is blocked
 *   STALE     a ledger row for a subject that no longer exists
 *
 * ⚠️ WHY A GATE AND NOT A DOCUMENT. The reason this phase exists is that a
 * conceptual inventory let `batchUpdates` slip through 55/55 green gates: the
 * notifier split moved delivery out of bare and nobody noticed the same class
 * had also carried producer-owned CONFIGURATION. A hand-written list cannot
 * report what its author forgot. STALE is checked for the same reason in the
 * other direction — a ledger that keeps rows for deleted code drifts into
 * fiction and starts certifying subjects that are not there.
 */
import { readFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const LEDGER = `${ROOT}/docs/architecture/kernel-ownership-ledger.md`;
const CENSUS = `${ROOT}/tools/kernel-ownership-census.json`;

const DISPOSITIONS = new Set([
  'KERNEL',
  'FRAMEWORK-ADAPTER',
  'OPTIONAL-CAPABILITY',
  'DOMAIN-SPECIALIZATION',
  'CONSTRUCTION-ONLY',
  'DIAGNOSTIC',
  'TEST-SEAM',
  'RETIRED',
  'AUTHORING-HELPER',
  'CONSEQUENCE',
  'UNKNOWN',
]);

/**
 * The SECOND axis. A known owner is not a converged implementation:
 * `defineStore` is decisively FRAMEWORK-ADAPTER and still sits inside the thing
 * we intend to call a neutral kernel.
 *
 *     KNOWN OWNER DOES NOT MEAN CONVERGED IMPLEMENTATION.
 *
 * Phase 3E therefore requires UNKNOWN owners = 0 AND unresolved actions = 0.
 * Gating on UNKNOWN alone would have authorised the strip with adapters still
 * living in the kernel.
 */
const ACTIONS = new Set([
  'CONVERGED', 'MOVE', 'SPLIT', 'REIMPLEMENT', 'DELETE', 'REVIEW',
]);

// ⚠️ PROVE THE OBSERVERS BEFORE TRUSTING THE CENSUS. Category accounting shows
// nothing was dropped between discovery and the gate; it cannot show that a
// detector can SEE the shapes it claims to find. Three parser failures in this
// tool's short life say that distinction is not theoretical, and two of them
// returned empty results that looked like facts about the repository.
try {
  execSync(`node ${ROOT}/tools/kernel-ownership-census.mjs --self-test`, { stdio: 'pipe' });
} catch (err) {
  console.error(
    '\n❌ census observer controls FAILED. The detectors cannot see what the\n' +
      '   census claims to find, so its output is not evidence.\n\n' +
      String(err.stdout ?? err.message)
  );
  process.exit(3); // distinct: the instrument failed, not the repository

}
// And the mutation proof: passing controls show the detectors SEE the planted
// shapes; only a killing mutation shows the controls would NOTICE if they
// stopped. Both run against the same implementations the census imports.
try {
  execSync(`node ${ROOT}/tools/census-mutation-proof.mjs`, { stdio: 'pipe' });
  // ⚠️ PUBLIC-SURFACE PARITY IS PART OF THE GATE, not a one-off check.
  // The census's public denominator once missed nine genuinely public types
  // because they were spelled as inline `type` members of value clauses. A
  // denominator that can silently shrink is not a denominator.
  execSync(`node ${ROOT}/tools/public-surface-census-parity.mjs`, { stdio: 'pipe' });
  // ⚠️ THE SUBJECT-IDENTITY SCHEME IS PART OF THE GATE. Bare-module ownership
  // rows are addressed by a normalized source path; a regression to basenames
  // would silently merge two subjects into one.
  execSync(`node ${ROOT}/tools/bare-module-identity-control.mjs`, { stdio: 'pipe' });
  // ⚠️ RUNTIME-COUPLING CLASSIFICATION IS PART OF THE GATE. Deciding it from
  // import statement kind created three C6 actions for work that did not exist.
  execSync(`node ${ROOT}/tools/angular-coupling-control.mjs`, { stdio: 'pipe' });
} catch (err) {
  console.error(
    '\n❌ census family mutation proof FAILED — at least one discovery family\n' +
      '   has controls that survive its own detector being broken.\n\n' +
      String(err.stdout ?? err.message)
  );
  process.exit(3);
}

// Subject-set parity between census discovery and the evidence collector, plus
// module-resolution integrity. COUNT PARITY IS NOT SUBJECT PARITY.
try {
  execSync(`node ${ROOT}/tools/module-state-parity.mjs`, { stdio: 'pipe' });
} catch (err) {
  console.error(
    '\n❌ module-state subject-set parity FAILED — the census and the evidence\n' +
      '   collector are not describing the same subjects.\n\n' +
      String(err.stdout ?? err.message)
  );
  process.exit(3);
}

execSync(`node ${ROOT}/tools/kernel-ownership-census.mjs`, { stdio: 'pipe' });
const census = JSON.parse(readFileSync(CENSUS, 'utf8'));

if (!existsSync(LEDGER)) {
  console.error(`\n❌ No ledger at ${LEDGER}. The census cannot certify itself.`);
  process.exit(1);
}
const ledgerSrc = readFileSync(LEDGER, 'utf8');

// Rows: | subject | ... | DISPOSITION |
const rows = new Map();
for (const line of ledgerSrc.split('\n')) {
  const m = line.match(/^\|\s*`([^`]+)`\s*\|(.+)\|\s*([A-Z-]+)\s*\|\s*([A-Z-]+)\s*\|\s*$/);
  if (!m) continue;
  if (!DISPOSITIONS.has(m[3])) {
    console.error(`❌ Unknown disposition "${m[3]}" for \`${m[1]}\``);
    process.exit(1);
  }
  if (!ACTIONS.has(m[4])) {
    console.error(`❌ Unknown convergence action "${m[4]}" for \`${m[1]}\``);
    process.exit(1);
  }
  rows.set(m[1], { owner: m[3], action: m[4] });
}

// ⚠️ THE SUBJECT SET COMES FROM THE CENSUS, NOT FROM A LIST HERE. The first
// checker rebuilt it by hand and omitted `runtimeState` and `pipelines`
// entirely, plus 43 public type exports and 6 marker factories — 74 discovered
// subjects that never reached the gate, while it reported a "complete census".
// A parallel list is a second source of truth, and the second one is always the
// one that rots.
const subjects = new Set(census.subjects.map((s) => s.key));

if (census.bareReachableModules === null) {
  console.error(
    '\n❌ Bundle reachability could not be measured, so bare-module coverage is\n' +
      '   unverifiable. Refusing to certify a partial census.'
  );
  process.exit(1);
}

const missing = [...subjects].filter((s) => !rows.has(s)).sort();
const unknown = [...rows].filter(([, r]) => r.owner === 'UNKNOWN').map(([s]) => s).sort();
const unconverged = [...rows]
  .filter(([, r]) => r.owner !== 'UNKNOWN' && r.action !== 'CONVERGED')
  .map(([s, r]) => `${s}  [${r.action}]`)
  .sort();
const stale = [...rows.keys()].filter((s) => !subjects.has(s)).sort();

const show = (label, list, cap = 25) => {
  if (!list.length) return;
  console.log(`\n${label} (${list.length})`);
  for (const s of list.slice(0, cap)) console.log(`    ${s}`);
  if (list.length > cap) console.log(`    ... and ${list.length - cap} more`);
};

console.log(
  `kernel-ownership: ${subjects.size} censused subjects, ${rows.size} ledger rows`
);
show('❌ MISSING — censused but unclassified', missing);
show('⛔ UNKNOWN — classification not yet decided; the strip is BLOCKED', unknown);
show('⚠️  STALE — ledger row for a subject that no longer exists', stale);

show('🔧 UNCONVERGED — owner known, implementation still misplaced', unconverged);

const byDisposition = {};
for (const [, r] of rows) byDisposition[r.owner] = (byDisposition[r.owner] ?? 0) + 1;
const byAction = {};
for (const [, r] of rows) byAction[r.action] = (byAction[r.action] ?? 0) + 1;
console.log('\ndispositions:');
for (const [d, n] of Object.entries(byDisposition).sort((a, b) => b[1] - a[1]))
  console.log(`  ${String(n).padStart(4)}  ${d}`);

if (missing.length || stale.length) {
  console.error('\n❌ The census and the ledger disagree. Strip is unsafe.');
  process.exit(1);
}
console.log('\nconvergence:');
for (const [a, n] of Object.entries(byAction).sort((x, y) => y[1] - x[1]))
  console.log(`  ${String(n).padStart(4)}  ${a}`);

if (unknown.length || unconverged.length) {
  console.error(
    `\n⛔ ${unknown.length} UNKNOWN owner(s) and ${unconverged.length} unresolved` +
      ' convergence action(s).\n   Phase 3E requires BOTH to be zero.'
  );
  process.exit(2);
}
console.log('\n✅ Every censused subject has an owner and a converged implementation.');
