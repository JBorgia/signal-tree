// The core gate (Jonathan's ruling before Phase 1 closes): when the new core
// is registered as a subject and selected, `oracle generate` fails on any
// spec violation by the core, and on any generatable behavior the core was
// checked on fewer times than the non-vacuity floor. The old packages (v15,
// v16) are never gated: their violations are findings (BRIEF.md 12.1.4).

/** The new core's subject name; ci/done-check.mjs reads it as ORACLE_SUBJECT. */
export const CORE_SUBJECT = 'core';

/**
 * Non-vacuity floors as ruled: at least 100 checked instances per behavior in
 * a 10,000-sequence PR run and 1,000 in a 100,000-sequence nightly run. Both
 * are one instance per SEQUENCES_PER_INSTANCE sequences.
 */
export const PR_FLOOR = { runs: 10_000, instances: 100 } as const;
export const NIGHTLY_FLOOR = { runs: 100_000, instances: 1_000 } as const;
export const SEQUENCES_PER_INSTANCE = 100;

/**
 * The floor for a run of `runs` sequences. Any run count gets the ruled
 * ratio, rounded up, so a shorter run (as in self-tests) still needs at
 * least one instance of every behavior, and a longer one needs
 * proportionally more.
 */
export function instanceFloor(runs: number): number {
  return Math.ceil(runs / SEQUENCES_PER_INSTANCE);
}

/** `oracle generate` exit codes. Bits 1 and 4 combine, so each failure stays distinguishable. */
export const EXIT = {
  /** Done; the core was not selected, or it holds every property above the floor. */
  ok: 0,
  /** The core violated a property. */
  coreViolation: 1,
  /** Bad arguments. */
  usage: 2,
  /** Generator error: a property threw, or an asynchronous error escaped every sequence. */
  generator: 3,
  /** A generatable behavior was checked on the core fewer times than the floor. */
  belowFloor: 4,
  /** Both 1 and 4. */
  coreViolationAndBelowFloor: 5,
} as const;

export interface GateInput {
  readonly runs: number;
  readonly subjects: readonly { readonly name: string }[];
  /** Per generatable behavior: sequences where it held, and where it was violated, per subject. */
  readonly stats: ReadonlyMap<string, { readonly holds: Readonly<Record<string, number>>; readonly violates: Readonly<Record<string, number>> }>;
}

export interface GateResult {
  readonly subject: string;
  /** Whether the core was among the subjects; when not, nothing is gated. */
  readonly applied: boolean;
  readonly floor: number;
  /** Sequences in which the core violated some behavior, summed over behaviors. */
  readonly violations: number;
  readonly violated: readonly { readonly behavior: string; readonly sequences: number }[];
  readonly belowFloor: readonly { readonly behavior: string; readonly instances: number }[];
  readonly exitCode: number;
}

/** Judges a generation result against the core gate. */
export function coreGate(result: GateInput, subject: string = CORE_SUBJECT): GateResult {
  const floor = instanceFloor(result.runs);
  const applied = result.subjects.some((s) => s.name === subject);
  if (!applied) return { subject, applied, floor, violations: 0, violated: [], belowFloor: [], exitCode: EXIT.ok };
  const violated: { behavior: string; sequences: number }[] = [];
  const belowFloor: { behavior: string; instances: number }[] = [];
  for (const [behavior, stats] of result.stats) {
    const v = stats.violates[subject] ?? 0;
    const instances = (stats.holds[subject] ?? 0) + v;
    if (v > 0) violated.push({ behavior, sequences: v });
    if (instances < floor) belowFloor.push({ behavior, instances });
  }
  const exitCode = (violated.length ? EXIT.coreViolation : 0) | (belowFloor.length ? EXIT.belowFloor : 0);
  return {
    subject,
    applied,
    floor,
    violations: violated.reduce((n, v) => n + v.sequences, 0),
    violated,
    belowFloor,
    exitCode,
  };
}
