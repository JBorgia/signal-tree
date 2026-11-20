// Spec-driven case generation (BRIEF.md 12.1.4). Generates seeded operation
// sequences, replays each on every subject, evaluates every behavior property
// that applies, and minimizes one sequence per way a subject violates a
// property, plus one sequence per property where it holds. Each minimized
// sequence becomes a candidate spec case: the property's expected outcome
// and, per subject, whether that subject holds, violates or never reaches it.
//
// Subjects are never compared with each other; a violation is a subject
// disagreeing with a property.
//
// Pass 1 runs fast-check with a property that always passes and records what
// each run index produced. Pass 2 replays one run per group (same seed,
// `path` = that run index) with a property that fails only while the group's
// condition still holds, so fast-check shrinks within the group; the result
// is then trimmed step by step, and write by write inside bodies.
import fc from 'fast-check';
import { CATALOG, isProperty } from './behaviors/catalog.js';
import type { BehaviorId, CatalogEntry, Property, Verdict } from './behaviors/types.js';
import { generationKinds, sequenceArb, type PluginMode } from './generate.js';
import { formatSequence, type Json, type Sequence } from './model.js';
import { runSequence } from './run.js';
import type { Subject } from './subject.js';
import type { SpecTrace } from './trace.js';

export type Provenance = 'holds' | 'violates' | 'n/a';

/** A candidate spec case. The file format under out/cases/. */
export interface SpecCase {
  /** File stem, e.g. `T3.violates.v16.cause-later-confirmed-dependency`. */
  readonly id: string;
  /** The behavior the case was minimized for (one ID today; a list so a case can prove several). */
  readonly behaviors: readonly BehaviorId[];
  readonly sequence: Sequence;
  /** The sequence in readable form. */
  readonly steps: readonly string[];
  /** The step the expected outcome is about. */
  readonly step: number;
  /** The outcome the behavior's row requires, from its property. */
  readonly expected: Json;
  readonly detail: string;
  /** Per subject: whether it holds, violates, or never reaches the behavior on this sequence. */
  readonly provenance: Readonly<Record<string, Provenance>>;
  /** Per subject that reaches it: what it did. */
  readonly observed: Readonly<Record<string, Json>>;
  readonly origin: {
    readonly minimizedOn: string;
    /** The violation kind the case was minimized for; absent for a holding case. */
    readonly violation?: string;
    readonly seed: number;
    readonly run: number;
    /** fast-check replay path of the shrunk sequence, before trimming. */
    readonly path: string;
  };
}

export interface BehaviorStats {
  /** Sequences in which the behavior applied on at least one subject. */
  exercised: number;
  /** Per subject: sequences where it applied and held throughout. */
  readonly holds: Record<string, number>;
  /** Per subject: sequences where it applied and was violated at least once. */
  readonly violates: Record<string, number>;
}

export interface ViolationGroup {
  readonly behavior: BehaviorId;
  readonly subject: string;
  readonly kind: string;
  readonly count: number;
  readonly firstRun: number;
  readonly case: string;
}

export interface GenerateOptions {
  readonly subjects: readonly Subject[];
  readonly runs: number;
  readonly seed: number;
  readonly plugins?: PluginMode;
  readonly maxSteps?: number;
  /** Property evaluations allowed per minimization, for shrinking and again for trimming. Deterministic. */
  readonly shrinkBudget?: number;
  readonly catalog?: readonly CatalogEntry[];
  readonly onProgress?: (done: number, total: number) => void;
}

export interface GenerateResult {
  readonly runs: number;
  readonly seed: number;
  readonly plugins: PluginMode;
  readonly maxSteps: number;
  readonly subjects: readonly { readonly name: string; readonly description: string }[];
  readonly catalog: readonly CatalogEntry[];
  readonly stats: ReadonlyMap<BehaviorId, BehaviorStats>;
  readonly groups: readonly ViolationGroup[];
  readonly cases: readonly SpecCase[];
  readonly generateMs: number;
  readonly shrinkMs: number;
}

/** A property threw: a defect in the generator, not a finding about a subject. */
export class PropertyError extends Error {
  constructor(
    readonly behavior: BehaviorId,
    readonly subject: string,
    readonly sequence: Sequence,
    readonly thrown: unknown
  ) {
    super(
      `property ${behavior} threw on ${subject}: ${thrown instanceof Error ? thrown.stack ?? thrown.message : String(thrown)}\n${formatSequence(sequence).join('\n')}`
    );
  }
}

export interface Evaluation {
  readonly subject: string;
  readonly trace: SpecTrace;
  /** Verdicts of the properties that apply. */
  readonly verdicts: ReadonlyMap<BehaviorId, Verdict>;
}

/** Replays `sequence` on `subject` and evaluates every property that applies. */
export async function evaluate(subject: Subject, sequence: Sequence, properties: readonly Property[]): Promise<Evaluation> {
  const trace: SpecTrace = { sequence, records: await runSequence(subject, sequence) };
  const verdicts = new Map<BehaviorId, Verdict>();
  for (const property of properties) {
    try {
      if (property.applies(trace)) verdicts.set(property.id, property.check(trace));
    } catch (thrown) {
      throw new PropertyError(property.id, subject.name, sequence, thrown);
    }
  }
  return { subject: subject.name, trace, verdicts };
}

export function arbitraryFor(options: Pick<GenerateOptions, 'subjects' | 'plugins' | 'maxSteps'>) {
  return sequenceArb({
    kinds: generationKinds(options.subjects),
    plugins: options.plugins ?? 'any',
    maxSteps: options.maxSteps ?? 30,
  });
}

const fileSafe = (text: string) => text.replace(/[^A-Za-z0-9_-]+/g, '-');

interface Target {
  readonly behavior: BehaviorId;
  readonly subject: Subject;
  /** Violation kind to reproduce, or undefined to reproduce a holding verdict. */
  readonly kind: string | undefined;
  readonly firstRun: number;
  readonly sequence: Sequence;
}

export async function generate(options: GenerateOptions): Promise<GenerateResult> {
  const { subjects, runs, seed } = options;
  const plugins = options.plugins ?? 'any';
  const maxSteps = options.maxSteps ?? 30;
  const catalog = options.catalog ?? CATALOG;
  const properties = catalog.filter(isProperty);
  const arb = arbitraryFor(options);

  const stats = new Map<BehaviorId, BehaviorStats>();
  for (const p of properties) {
    stats.set(p.id, {
      exercised: 0,
      holds: Object.fromEntries(subjects.map((s) => [s.name, 0])),
      violates: Object.fromEntries(subjects.map((s) => [s.name, 0])),
    });
  }
  const violations = new Map<string, Target & { count: number }>();
  const holding = new Map<BehaviorId, Target>();

  let index = 0;
  const started = performance.now();
  const pass = await fc.check(
    fc.asyncProperty(arb, async (sequence) => {
      const run = index++;
      const applied = new Set<BehaviorId>();
      for (const subject of subjects) {
        const { verdicts } = await evaluate(subject, sequence, properties);
        for (const [behavior, verdict] of verdicts) {
          applied.add(behavior);
          const s = stats.get(behavior) as BehaviorStats;
          if (verdict.holds) {
            s.holds[subject.name] = (s.holds[subject.name] ?? 0) + 1;
            if (!holding.has(behavior)) holding.set(behavior, { behavior, subject, kind: undefined, firstRun: run, sequence });
          } else {
            s.violates[subject.name] = (s.violates[subject.name] ?? 0) + 1;
            const key = `${behavior}|${subject.name}|${verdict.kind}`;
            const group = violations.get(key);
            if (group) group.count++;
            else violations.set(key, { behavior, subject, kind: verdict.kind, firstRun: run, sequence, count: 1 });
          }
        }
      }
      for (const behavior of applied) (stats.get(behavior) as BehaviorStats).exercised++;
      options.onProgress?.(run + 1, runs);
      return true;
    }),
    { seed, numRuns: runs }
  );
  if (pass.failed) throw pass.errorInstance ?? new Error('generation pass failed');
  const generateMs = performance.now() - started;

  const shrinkStarted = performance.now();
  const cases: SpecCase[] = [];
  const groups: ViolationGroup[] = [];
  const order = (a: Target, b: Target) =>
    catalog.findIndex((e) => e.id === a.behavior) - catalog.findIndex((e) => e.id === b.behavior) ||
    a.subject.name.localeCompare(b.subject.name) ||
    a.firstRun - b.firstRun;
  for (const group of [...violations.values()].sort(order)) {
    const c = await caseFor(options, arb, properties, group);
    cases.push(c);
    groups.push({
      behavior: group.behavior,
      subject: group.subject.name,
      kind: group.kind as string,
      count: group.count,
      firstRun: group.firstRun,
      case: c.id,
    });
  }
  for (const target of [...holding.values()].sort(order)) {
    cases.push(await caseFor(options, arb, properties, target));
  }

  return {
    runs,
    seed,
    plugins,
    maxSteps,
    subjects: subjects.map((s) => ({ name: s.name, description: s.description })),
    catalog,
    stats,
    groups,
    cases,
    generateMs,
    shrinkMs: performance.now() - shrinkStarted,
  };
}

/** Whether `subject` reproduces the target's verdict on `sequence`. */
async function reproduces(target: Target, properties: readonly Property[], sequence: Sequence): Promise<Verdict | undefined> {
  const property = properties.find((p) => p.id === target.behavior) as Property;
  const { verdicts } = await evaluate(target.subject, sequence, [property]);
  const verdict = verdicts.get(target.behavior);
  if (!verdict) return undefined;
  if (target.kind === undefined) return verdict.holds ? verdict : undefined;
  return !verdict.holds && verdict.kind === target.kind ? verdict : undefined;
}

async function caseFor(
  options: GenerateOptions,
  arb: fc.Arbitrary<Sequence>,
  properties: readonly Property[],
  target: Target
): Promise<SpecCase> {
  const minimized = await minimize(options, arb, properties, target);
  const primary = minimized.verdict;
  const provenance: Record<string, Provenance> = {};
  const observed: Record<string, Json> = {};
  for (const subject of options.subjects) {
    const { verdicts } = await evaluate(subject, minimized.sequence, properties.filter((p) => p.id === target.behavior));
    const verdict = verdicts.get(target.behavior);
    provenance[subject.name] = verdict ? (verdict.holds ? 'holds' : 'violates') : 'n/a';
    if (verdict) observed[subject.name] = verdict.observed;
  }
  const id =
    target.kind === undefined
      ? `${target.behavior}.holds`
      : `${target.behavior}.violates.${target.subject.name}.${fileSafe(target.kind)}`;
  return {
    id,
    behaviors: [target.behavior],
    sequence: minimized.sequence,
    steps: formatSequence(minimized.sequence),
    step: primary.step,
    expected: primary.expected,
    detail: primary.detail,
    provenance,
    observed,
    origin: {
      minimizedOn: target.subject.name,
      ...(target.kind === undefined ? {} : { violation: target.kind }),
      seed: options.seed,
      run: target.firstRun,
      path: minimized.path,
    },
  };
}

async function minimize(
  options: GenerateOptions,
  arb: fc.Arbitrary<Sequence>,
  properties: readonly Property[],
  target: Target
): Promise<{ sequence: Sequence; verdict: Verdict; path: string }> {
  const budget = options.shrinkBudget ?? 300;
  const initial = await reproduces(target, properties, target.sequence);
  if (!initial) throw new Error(`run ${target.firstRun} no longer reproduces ${target.behavior} on ${target.subject.name}`);
  let best = { sequence: target.sequence, verdict: initial };
  let evaluations = 0;
  const details = await fc.check(
    fc.asyncProperty(arb, async (sequence) => {
      // Past the budget every candidate "passes", which ends shrinking at the best found so far.
      if (evaluations++ >= budget) return true;
      const verdict = await reproduces(target, properties, sequence);
      if (!verdict) return true;
      best = { sequence, verdict };
      return false;
    }),
    { seed: options.seed, path: String(target.firstRun), numRuns: 1, endOnFailure: false }
  );
  const path = details.failed && details.counterexamplePath !== null ? details.counterexamplePath : String(target.firstRun);

  // fast-check shrinks arrays mostly by dropping leading items; remove the rest one at a time.
  let trims = 0;
  const attempt = async (candidate: Sequence): Promise<boolean> => {
    if (candidate.steps.length === 0 || trims++ >= budget) return false;
    const verdict = await reproduces(target, properties, candidate);
    if (!verdict) return false;
    best = { sequence: candidate, verdict };
    return true;
  };
  await attempt({ config: best.sequence.config, steps: best.sequence.steps.slice(0, best.verdict.step + 1) });
  for (let changed = true; changed; ) {
    changed = false;
    for (let i = best.sequence.steps.length - 1; i >= 0; i--) {
      if (await attempt({ config: best.sequence.config, steps: best.sequence.steps.filter((_, j) => j !== i) })) {
        changed = true;
      }
    }
    // Then single writes inside transaction and declaration bodies.
    for (let i = best.sequence.steps.length - 1; i >= 0; i--) {
      const op = best.sequence.steps[i]?.op;
      if (!op || (op.kind !== 'transact' && op.kind !== 'declare')) continue;
      for (let w = op.body.length - 1; w >= 0 && op.body.length > 1; w--) {
        const body = op.body.filter((_, k) => k !== w);
        const steps = best.sequence.steps.map((s, j) => (j === i ? { ...s, op: { ...op, body } } : s));
        if (await attempt({ config: best.sequence.config, steps })) {
          changed = true;
          break;
        }
      }
    }
  }
  for (const plugin of ['transactions', 'restoration'] as const) {
    if (best.sequence.config[plugin]) {
      await attempt({ config: { ...best.sequence.config, [plugin]: false }, steps: best.sequence.steps });
    }
  }
  for (let i = 0; i < best.sequence.steps.length; i++) {
    const step = best.sequence.steps[i];
    if (!step?.sameTick) continue;
    await attempt({ config: best.sequence.config, steps: best.sequence.steps.map((s, j) => (j === i ? { ...s, sameTick: false } : s)) });
  }
  return { ...best, path };
}

/** Judges one known sequence on each subject for one behavior, without generation: pins hand-written examples. */
export async function judge(
  subjects: readonly Subject[],
  behavior: BehaviorId,
  sequence: Sequence,
  catalog: readonly CatalogEntry[] = CATALOG
): Promise<{ provenance: Record<string, Provenance>; verdicts: Record<string, Verdict | undefined> }> {
  const property = catalog.filter(isProperty).find((p) => p.id === behavior);
  if (!property) throw new Error(`${behavior} has no property`);
  const provenance: Record<string, Provenance> = {};
  const verdicts: Record<string, Verdict | undefined> = {};
  for (const subject of subjects) {
    const verdict = (await evaluate(subject, sequence, [property])).verdicts.get(behavior);
    verdicts[subject.name] = verdict;
    provenance[subject.name] = verdict ? (verdict.holds ? 'holds' : 'violates') : 'n/a';
  }
  return { provenance, verdicts };
}
