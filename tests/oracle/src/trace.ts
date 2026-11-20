// What a behavior property reads: one sequence and the trace one subject
// produced for it.
import type { Sequence, Trace } from './model.js';

export interface SpecTrace {
  readonly sequence: Sequence;
  /** One record per step, then a final `end` record. */
  readonly records: Trace;
}

/** Stable serialization: object keys sorted, so key order never counts as a difference. */
export function canonical(value: unknown): string {
  if (value === undefined) return 'null';
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([x], [y]) => (x < y ? -1 : x > y ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
}

/** Index of the first record at which two traces of one sequence differ, or -1. */
export function firstMismatch(a: Trace, b: Trace): number {
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i++) {
    if (canonical(a[i]) !== canonical(b[i])) return i;
  }
  return -1;
}
