#!/usr/bin/env node
/**
 * Gate: retired-subject retention has NO MEASURABLE SLOPE.
 *
 * ## What this pins, and why it is not a byte budget
 *
 * Zero-owner retirement forgets the whole subject — value backing, entity
 * signal, lifetime record, revision entry — and the measured result is ~6 B per
 * retired subject, which is the quiescence protocol's noise floor rather than a
 * cost. The claim worth defending is NOT "6 B". It is the asymptotic one:
 *
 *     retention does not grow with the number of subjects that have retired
 *
 * A byte budget cannot express that. 117 B/retired passes any budget generous
 * enough to be stable, and 117 B/retired is unbounded growth. So this gate
 * measures the SAME workload at two subject counts and fails if the total grows
 * with them.
 *
 * ## The criterion
 *
 * Rounds triple, so genuinely linear retention triples the total. Two
 * conditions, both required:
 *
 *   1. total growth at 3x the retirements must not exceed 2x the total at 1x
 *      (a linear regime gives ~3x; the slack absorbs noise, not a slope)
 *   2. per-retired must stay inside +/-20 B at BOTH points
 *
 * Condition 2 alone would pass a small constant leak; condition 1 alone is
 * unstable when both totals sit in the noise. Together they say "flat".
 *
 * ## Before you raise the tolerance
 *
 * A failure here means retention started scaling with retirement count again.
 * The likely cause is something re-interning a forgotten subject by id — that is
 * how this regressed once already, when `publishSubjectPhysicalChange` ->
 * `bumpSubjectRevision` recreated the revision entry inside the same retirement
 * and turned 6 B/retired into 79 B/retired. Look for that before touching the
 * numbers. `entity-lifetime-ledger-null.spec.ts` has the unit-level version.
 *
 * Usage: node --expose-gc tools/check-retired-subject-slope.mjs [--self-test]
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const BENCH = join(process.cwd(), 'tools/bench-entity-churn-retention.mjs');
const ARM = 'no-history-reads';
const LOW_ROUNDS = 50;
const HIGH_ROUNDS = 150;
const MAX_GROWTH_RATIO = 2;
const MAX_BYTES_PER_RETIRED = 20;

function judge(low, high) {
  const problems = [];

  // Only meaningful when the low arm actually grew; if it did not, a ratio is a
  // division by noise and condition 2 carries the check on its own.
  if (low.growthMB > 0.5 && high.growthMB > low.growthMB * MAX_GROWTH_RATIO) {
    problems.push(
      `total growth scaled with retirements: ${low.growthMB} MB at ` +
        `${low.retiredSubjects} retired -> ${high.growthMB} MB at ` +
        `${high.retiredSubjects} (more than ${MAX_GROWTH_RATIO}x for 3x the subjects)`
    );
  }

  for (const point of [low, high]) {
    if (Math.abs(point.bytesPerRetiredSubject) > MAX_BYTES_PER_RETIRED) {
      problems.push(
        `${point.retiredSubjects} retired subjects cost ` +
          `${point.bytesPerRetiredSubject} B each, over the ` +
          `+/-${MAX_BYTES_PER_RETIRED} B flat band`
      );
    }
  }

  return problems;
}

if (process.argv.includes('--self-test')) {
  // A checker that cannot detect the regime it exists to detect is worse than
  // absent. Feed it the pre-fix table and require rejection, then the current
  // one and require acceptance.
  const linear = judge(
    { growthMB: 5.6, retiredSubjects: 50_000, bytesPerRetiredSubject: 117 },
    { growthMB: 18.79, retiredSubjects: 150_000, bytesPerRetiredSubject: 131 }
  );
  const flat = judge(
    { growthMB: 0.3, retiredSubjects: 50_000, bytesPerRetiredSubject: 6 },
    { growthMB: -0.83, retiredSubjects: 150_000, bytesPerRetiredSubject: -6 }
  );

  if (linear.length === 0) {
    console.error(
      '\n❌ self-test: the checker ACCEPTED the pre-fix linear table ' +
        '(117 B/retired growing to 131 B). It cannot see a slope.'
    );
    process.exit(1);
  }
  if (flat.length > 0) {
    console.error(
      `\n❌ self-test: the checker REJECTED the measured flat table:\n  ${flat.join(
        '\n  '
      )}`
    );
    process.exit(1);
  }
  console.log(
    '✅ self-test: rejects the pre-fix linear table, accepts the flat one.'
  );
  process.exit(0);
}

if (typeof globalThis.gc !== 'function') {
  console.error(
    '\n❌ requires --expose-gc. Retention is only measurable after a forced ' +
      'collection; without one this would report allocation noise as a slope.'
  );
  process.exit(1);
}

if (!existsSync(BENCH)) {
  console.error(`\n❌ missing ${BENCH}`);
  process.exit(1);
}

const runArm = (rounds) => {
  const out = execFileSync(
    process.execPath,
    ['--expose-gc', BENCH, '--arm', ARM, '--rounds', String(rounds)],
    { encoding: 'utf8' }
  );
  return JSON.parse(out.trim().split('\n').at(-1));
};

console.log(
  `Retired-subject retention slope — arm "${ARM}", ` +
    `${LOW_ROUNDS} vs ${HIGH_ROUNDS} rounds\n`
);

const low = runArm(LOW_ROUNDS);
const high = runArm(HIGH_ROUNDS);

for (const point of [low, high]) {
  console.log(
    `  ${String(point.retiredSubjects).padStart(7)} retired   ` +
      `${String(point.growthMB).padStart(7)} MB   ` +
      `${String(point.bytesPerRetiredSubject).padStart(5)} B/retired`
  );
}

const problems = judge(low, high);
if (problems.length > 0) {
  console.error(`\n❌ retention is scaling with retired subjects:`);
  for (const problem of problems) console.error(`   - ${problem}`);
  console.error(
    '\n   Read the header before adjusting the tolerance: this regressed once ' +
      '\n   because a later step re-interned a forgotten subject by id.'
  );
  process.exit(1);
}

console.log(
  '\n✅ no measurable slope: 3x the retirements did not scale the total, and ' +
    `both points are inside +/-${MAX_BYTES_PER_RETIRED} B/retired.`
);
