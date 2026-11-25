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

/**
 * Behaviors every generated instance of which needs a plugin the core does
 * not have yet (#107, adopted provisionally). Until the phase that builds the
 * plugin, the core floor skips them and the result lists them; the core is
 * still gated on any violation of them, and ci/done-check.mjs still requires
 * each one's nightly floor, so the definition of done cannot pass without
 * them. A behavior leaves this list in the PR that makes the core replay it.
 */
export const AWAITING_PLUGINS: Readonly<Record<string, string>> = {
  T1: 'transactions (Phase 3)',
  T2: 'transactions (Phase 3)',
  T3: 'transactions (Phase 3)',
  T4: 'transactions (Phase 3)',
  T5: 'transactions (Phase 3)',
  T6: 'transactions (Phase 3)',
  T7: 'transactions (Phase 3)',
  T9: 'transactions (Phase 3)',
  R1: 'restoration (Phase 4)',
  R2: 'restoration (Phase 4)',
  R3: 'restoration (Phase 4)',
  L1: 'writers (Phase 5)',
  L2: 'writers (Phase 5)',
  X1: 'transactions and restoration (Phases 3–4): its generated refusals are rollback, undo and redo',
  W5: 'transactions and restoration (Phases 3–4): its awaiting scopes are transact() and undoable()',
};

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
  /** Behaviors below the floor that wait for a plugin (AWAITING_PLUGINS): reported, not failed. */
  readonly awaitingPlugins: readonly { readonly behavior: string; readonly instances: number; readonly plugin: string }[];
  readonly exitCode: number;
}

/** Judges a generation result against the core gate. */
export function coreGate(result: GateInput, subject: string = CORE_SUBJECT): GateResult {
  const floor = instanceFloor(result.runs);
  const applied = result.subjects.some((s) => s.name === subject);
  if (!applied) return { subject, applied, floor, violations: 0, violated: [], belowFloor: [], awaitingPlugins: [], exitCode: EXIT.ok };
  const violated: { behavior: string; sequences: number }[] = [];
  const belowFloor: { behavior: string; instances: number }[] = [];
  const awaitingPlugins: { behavior: string; instances: number; plugin: string }[] = [];
  for (const [behavior, stats] of result.stats) {
    const v = stats.violates[subject] ?? 0;
    const instances = (stats.holds[subject] ?? 0) + v;
    if (v > 0) violated.push({ behavior, sequences: v });
    if (instances >= floor) continue;
    const plugin = subject === CORE_SUBJECT ? AWAITING_PLUGINS[behavior] : undefined;
    if (plugin) awaitingPlugins.push({ behavior, instances, plugin });
    else belowFloor.push({ behavior, instances });
  }
  const exitCode = (violated.length ? EXIT.coreViolation : 0) | (belowFloor.length ? EXIT.belowFloor : 0);
  return {
    subject,
    applied,
    floor,
    violations: violated.reduce((n, v) => n + v.sequences, 0),
    violated,
    belowFloor,
    awaitingPlugins,
    exitCode,
  };
}
