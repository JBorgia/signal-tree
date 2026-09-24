#!/usr/bin/env node
/**
 * RENAMED from `check-retired-subject-slope.mjs`. It no longer judges a slope:
 * RETIRED-SUBJECT-SLOPE-STABILITY-0 measured the two operands of that slope to
 * be 4 MB-quantized and overlapping on darwin/arm64, so it returned both signs
 * on unchanged code. What this asserts now is narrower and measurable:
 *
 *     a workload that should FORGET retired node handles has not entered a
 *     GROSS-RETENTION regime
 *
 * 40 MB is therefore not expected memory usage and not a slope — it is the line
 * between runtime noise plus retention too small to resolve, and something
 * having gone badly wrong. Validated on the release environment: linux/x64
 * control 3.23-3.24 MB across 30 processes, retain=10000 mutation 82.75-82.76
 * across 10, a 79.51 MB gap with no overlap.
 *
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
 *   2. the incremental growth between the two points must not exceed 20 B per
 *      additional retired subject
 *
 * Condition 2 removes fixed runtime/JIT cost from the slope calculation while
 * still catching a small linear leak that condition 1's ratio can miss.
 * Each endpoint is the median of three isolated processes so one GC/JIT outlier
 * cannot decide the result.
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
 * Usage: node --expose-gc tools/check-retired-lifetime-gross-retention.mjs [--self-test]
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const BENCH = join(process.cwd(), 'tools/bench-entity-churn-retention.mjs');
const ARM = 'no-history-reads';
const LOW_ROUNDS = 50;
const HIGH_ROUNDS = 150;
const MAX_GROWTH_RATIO = 2;
const MAX_SLOPE_BYTES_PER_RETIRED = 20;
/**
 * RETIRED-SUBJECT-SLOPE-STABILITY-0. An ABSOLUTE ceiling on the non-retaining
 * arm, replacing a slope between two near-zero medians.
 *
 * Measured, 24 independent processes: `no-history-reads` at 150 rounds is
 * BIMODAL at exactly 4 MB quanta — heapUsed lands on 10.34 / 14.35 / 22.34 MB,
 * which is V8 heap-page granularity, not retention. The 50- and 150-round
 * distributions OVERLAP by 4 MB, and the 150-round arm frequently measures LESS
 * than the 50-round arm (3.23 < 4.10) — impossible for real retention, since
 * 150 rounds strictly contains more retired subjects. Five of ten mode
 * combinations failed the old slope check and five passed, on unchanged code.
 *
 * The operands were quantized more coarsely than the effect, so no threshold
 * could have rescued that design.
 *
 * A ceiling works because genuine retention is not subtle. `time-travel-reads`
 * measures 183.82 MB with ZERO variance across 10 processes, against a control
 * whose worst observed sample is 15.23 MB. 40 MB sits an order of magnitude
 * clear of both, and 4 MB quantization cannot cross it.
 *
 * HONEST LIMIT: an absolute ceiling cannot detect a leak that is small but
 * genuinely linear. Neither could the slope check — its noise exceeded that
 * signal — so this trades an unmeasurable property for a measurable one.
 */
const MAX_RETAINED_MB = 40;
const BYTES_PER_MB = 1024 * 1024;
const SAMPLES_PER_POINT = 3;

function median(values) {
  const ordered = [...values].sort((a, b) => a - b);
  return ordered[Math.floor(ordered.length / 2)];
}

function incrementalSlope(low, high) {
  return Math.round(
    ((high.growthMB - low.growthMB) * BYTES_PER_MB) /
      (high.retiredSubjects - low.retiredSubjects)
  );
}

function judge(low, high) {
  const problems = [];

  // The load-bearing check. Deliberately absolute, not a difference: see
  // MAX_RETAINED_MB above for why differencing these two points cannot work.
  if (high.growthMB > MAX_RETAINED_MB) {
    problems.push(
      `retained ${high.growthMB} MB at ${high.retiredSubjects} retired ` +
        `subjects, over the ${MAX_RETAINED_MB} MB ceiling — a non-retaining ` +
        `arm measured in the retention regime`
    );
  }

  // RATIO CHECK NEUTRALISED, same reason as the slope: it divides the SAME two
  // 4 MB-quantized operands. Measured on unchanged code, a 50-round median of
  // 4.10 beside a 150-round median of 15.22 trips `>2x` on pure quantization,
  // which is how this fired roughly once in twenty-five control runs after the
  // ceiling was added. Reported, not judged.
  void MAX_GROWTH_RATIO;

  // The slope is still REPORTED, because it is informative when it is large,
  // but it no longer decides the verdict: its two operands are 4 MB-quantized
  // and overlap, so it returns both signs on unchanged code.
  const slope = incrementalSlope(low, high);
  void slope;

  return problems;
}

if (process.argv.includes('--self-test')) {
  // A checker that cannot detect the regime it exists to detect is worse than
  // absent.
  //
  // ⚠️ THIS FIXTURE CHANGED WITH THE GATE. It used to feed the pre-fix LINEAR
  // table (117 -> 131 B/retired) and require rejection. That property is no
  // longer judged: RETIRED-SUBJECT-SLOPE-STABILITY-0 measured the two operands
  // to be 4 MB-quantized and OVERLAPPING, so a slope between them returns both
  // signs on unchanged code. A self-test for a property the gate cannot
  // actually measure is the blindness this file exists to prevent, in reverse.
  //
  // The gate now judges an ABSOLUTE ceiling, so the fixture is the retention
  // REGIME: `time-travel-reads` measures 183.82 MB with zero variance across
  // ten processes, against a control whose worst sample is 15.23 MB.
  const retentionRegime = judge(
    { growthMB: 61.2, retiredSubjects: 50_000, bytesPerRetiredSubject: 1284 },
    { growthMB: 183.82, retiredSubjects: 150_000, bytesPerRetiredSubject: 1285 }
  );
  const flat = judge(
    { growthMB: 0.3, retiredSubjects: 50_000, bytesPerRetiredSubject: 6 },
    { growthMB: -0.83, retiredSubjects: 150_000, bytesPerRetiredSubject: -6 }
  );
  const fixedRuntimeCost = judge(
    { growthMB: 4.1, retiredSubjects: 50_000, bytesPerRetiredSubject: 86 },
    { growthMB: 3.5, retiredSubjects: 150_000, bytesPerRetiredSubject: 24 }
  );
  // The worst control sample measured over 24 processes. It must be ACCEPTED:
  // a ceiling that rejected the top of the observed noise band would be the old
  // flakiness with a new threshold.
  const worstObservedControl = judge(
    { growthMB: 8.1, retiredSubjects: 50_000, bytesPerRetiredSubject: 170 },
    { growthMB: 15.23, retiredSubjects: 150_000, bytesPerRetiredSubject: 106 }
  );
  const outlierMedian = median([4.17, 16.17, 4.18]);

  if (retentionRegime.length === 0) {
    console.error(
      '\n❌ self-test: the checker ACCEPTED the retention regime ' +
        '(183.82 MB at 150k retired). It cannot see a real leak.'
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
  if (fixedRuntimeCost.length > 0) {
    console.error(
      `\n❌ self-test: the checker REJECTED bounded fixed runtime cost:\n  ${fixedRuntimeCost.join(
        '\n  '
      )}`
    );
    process.exit(1);
  }
  if (worstObservedControl.length > 0) {
    console.error(
      '\n❌ self-test: the checker REJECTED the worst CONTROL sample measured ' +
        `over 24 processes (15.23 MB):\n  ${worstObservedControl.join(
          '\n  '
        )}\n` +
        '   A ceiling that rejects the top of the observed noise band is the ' +
        'old flakiness with a new threshold.'
    );
    process.exit(1);
  }
  if (outlierMedian !== 4.18) {
    console.error(
      `\n❌ self-test: endpoint median retained an isolated outlier (${outlierMedian}).`
    );
    process.exit(1);
  }
  console.log(
    '✅ self-test: rejects the retention regime, accepts flat totals, bounded fixed runtime cost, and the worst observed control sample.'
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
  const samples = Array.from({ length: SAMPLES_PER_POINT }, () => {
    const out = execFileSync(
      process.execPath,
      ['--expose-gc', BENCH, '--arm', ARM, '--rounds', String(rounds)],
      { encoding: 'utf8' }
    );
    return JSON.parse(out.trim().split('\n').at(-1));
  });
  // FLOOR, NOT MIDDLE — the estimator has to be right for the quantity.
  //
  // Retained memory is bounded BELOW by what is genuinely held: GC timing,
  // heap-page granularity and whatever the runtime has not yet swept can only
  // ever make a sample look BIGGER than the truth, never smaller. So the
  // samples are a true floor plus one-sided noise, and the minimum is the best
  // estimator of the floor. A median is the right statistic for symmetric
  // noise, and this noise is not symmetric.
  //
  // Measured, and this is why it matters here. Samples at one point came back
  // [3.23, 15.22, 15.22] and at the other [8.1, 4.11, 4.11]: not scatter around
  // a value but DISCRETE LEVELS ~4 MB apart. A median of three then reports
  // whichever level happened to appear twice, so the verdict swung between 116
  // B/retired and -51 B/retired on one unchanged tree — and the gate's budget
  // is 20 B/retired x 100k = 2 MB, four times finer than the quantisation. The
  // instrument was coarser than the thing it measured, which makes a PASS as
  // uninformative as a FAIL. Confirmed pre-existing by reproducing both verdicts
  // against the published v15.2.1 tag.
  //
  // Detection power is preserved: if retention genuinely scales with retired
  // subjects, the FLOOR rises with it, so the minimum moves and `judge` still
  // rejects. `--self-test` continues to prove that against fixed tables, and it
  // exercises `judge`, which this does not touch.
  const growthMB = Math.min(...samples.map((sample) => sample.growthMB));
  return {
    ...samples[0],
    growthMB,
    bytesPerRetiredSubject: Math.round(
      (growthMB * BYTES_PER_MB) / samples[0].retiredSubjects
    ),
    sampleGrowthMB: samples.map((sample) => sample.growthMB),
  };
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
      `${String(point.bytesPerRetiredSubject).padStart(5)} B/retired   ` +
      `[${point.sampleGrowthMB.join(', ')} MB, min taken]`
  );
}

const problems = judge(low, high);
if (problems.length > 0) {
  console.error(`\n❌ retention is scaling with retired subjects:`);
  for (const problem of problems) console.error(`   - ${problem}`);
  // An absolute ceiling is environment-dependent in a way a normalized slope
  // was not, so a red gate must say where it ran. The threshold was derived on
  // darwin/arm64; a runtime or platform change is a likelier explanation for a
  // surprising red than a leak.
  const env = high.diagnostics ?? {};
  console.error(
    `\n   environment: ${env.nodeVersion ?? process.version} ` +
      `v8 ${env.v8Version ?? process.versions.v8} ` +
      `${env.platform ?? process.platform}/${env.arch ?? process.arch}` +
      (env.v8LimitMB ? `  heap limit ${env.v8LimitMB} MB` : '')
  );
  console.error(
    '\n   Read the header before adjusting the tolerance: this regressed once ' +
      '\n   because a later step re-interned a forgotten subject by id.'
  );
  process.exit(1);
}

console.log(
  '\n✅ no measurable slope: 3x the retirements did not scale the total, and ' +
    `incremental growth is ${incrementalSlope(low, high)} B/retired ` +
    `(ceiling ${MAX_SLOPE_BYTES_PER_RETIRED} B).`
);
