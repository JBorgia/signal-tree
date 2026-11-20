// The behavior catalog's contract. A property is written from one BRIEF.md 5.1
// row's text and nothing else: `expected` is what the row requires, never
// what a subject did (BRIEF.md 12.1.1, 12.1.4).
import type { Json } from '../model.js';
import type { SpecTrace } from '../trace.js';
import { analyze, destroyedAt } from './analysis.js';

/** Every behavior in BRIEF.md 5.1, 5.2 and 12.4, in table order. */
export const BEHAVIOR_IDS = [
  'T1',
  'T2',
  'T3',
  'T4',
  'T5',
  'T6',
  'T7',
  'T8',
  'T9',
  'T10',
  'R1',
  'R2',
  'R3',
  'R4',
  'E1',
  'E2',
  'L1',
  'L2',
  'L3',
  'X1',
  'X2',
  'W1',
  'W2',
  'W3',
  'W4',
  'O1',
  'O2',
  'O3',
  'O4',
  'X3',
  'D1',
  'D2',
  'W5',
  'H1',
] as const;
export type BehaviorId = (typeof BEHAVIOR_IDS)[number];

export interface Verdict {
  readonly holds: boolean;
  /** The outcome the row requires. */
  readonly expected: Json;
  /** What the subject did, in the same terms. */
  readonly observed: Json;
  readonly detail: string;
  /** The step the verdict is about. */
  readonly step: number;
  /** For a violation, a short filename-safe name for how it was violated; violations are grouped by it. */
  readonly kind: string;
}

export interface Property {
  readonly id: BehaviorId;
  readonly generatable: true;
  /** The BRIEF.md row, verbatim. */
  readonly row: string;
  /** Clauses of the row this property does not check, and how it reads ambiguous wording. */
  readonly reason?: string;
  /** Whether the replayed sequence exercises the behavior. */
  applies(trace: SpecTrace): boolean;
  /** The first violation in the trace, or a holding verdict. Throws when the property does not apply. */
  check(trace: SpecTrace): Verdict;
}

export interface Unexpressed {
  readonly id: BehaviorId;
  readonly generatable: false;
  readonly row: string;
  readonly reason: string;
}

export type CatalogEntry = Property | Unexpressed;

/** One place in a trace where a property applies, with its verdict. */
export type Instance = Verdict;

/**
 * Builds a property from a function listing every place in a trace where the
 * row applies. Instances are computed once per trace. Once a tree is
 * destroyed, what it does is D1's matter alone: instances at or after a
 * destroy() that returned are dropped unless `afterDestroy` is set.
 */
export function instanceProperty(def: {
  readonly id: BehaviorId;
  readonly row: string;
  readonly reason?: string;
  readonly afterDestroy?: boolean;
  readonly instances: (trace: SpecTrace) => readonly Instance[];
}): Property {
  const cache = new WeakMap<SpecTrace, readonly Instance[]>();
  const of = (trace: SpecTrace) => {
    let found = cache.get(trace);
    if (!found) {
      found = def.instances(trace);
      const destroyed = def.afterDestroy ? undefined : destroyedAt(analyze(trace));
      if (destroyed !== undefined) found = found.filter((i) => i.step < destroyed);
      cache.set(trace, found);
    }
    return found;
  };
  return {
    id: def.id,
    generatable: true,
    row: def.row,
    ...(def.reason ? { reason: def.reason } : {}),
    applies: (trace) => of(trace).length > 0,
    check: (trace) => {
      const all = of(trace);
      const verdict = all.find((v) => !v.holds) ?? all[0];
      if (!verdict) throw new Error(`${def.id} does not apply to this trace`);
      return verdict;
    },
  };
}

/** A holding instance. */
export function holds(step: number, expected: Json, observed: Json, detail: string): Instance {
  return { holds: true, expected, observed, detail, step, kind: '' };
}

/** A violating instance. */
export function violates(step: number, kind: string, expected: Json, observed: Json, detail: string): Instance {
  return { holds: false, expected, observed, detail, step, kind };
}

/** A holding or violating instance, by `ok`. */
export function verdict(ok: boolean, step: number, kind: string, expected: Json, observed: Json, detail: string): Instance {
  return ok ? holds(step, expected, observed, detail) : violates(step, kind, expected, observed, detail);
}
