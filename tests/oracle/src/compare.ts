// Step-by-step comparison of two traces of the same sequence.
//
// Each step is flattened into named outcome fields. The first step at which a
// field differs without an intended-differences entry is the divergence; later
// steps are not compared, because their state may already have diverged. A
// step whose every differing field is covered is recorded as intended and
// comparison continues.
import type { Json, Outcome, StepRecord, Trace } from './model.js';
import type { IntendedDifference } from './intended.js';

/** Fields in priority order: the first differing one names the divergence. */
export const FIELDS = [
  'result.status',
  'result.error.causeKind',
  'result.error.class',
  'result.error.code',
  'result.error.st',
  'result.error.stage',
  'result.error.reason',
  'result.error.recovery',
  'result.error.message',
  'result.value',
  'state.a',
  'state.cfg',
  'state.rows',
  'state.ids',
  'state.readError',
  'restoration.canUndo',
  'restoration.canRedo',
  'restoration.index',
  'restoration.length',
  'receipts',
  'link.pushes',
  'link.probes',
  'treeErrors',
  'warnings',
  'asyncErrors',
] as const;
export type Field = (typeof FIELDS)[number];

/** Fields whose values are small vocabularies; their values become part of the group key. */
const ENUM_FIELDS = new Set<Field>([
  'result.status',
  'result.error.causeKind',
  'result.error.class',
  'result.error.code',
  'result.error.st',
  'result.error.stage',
  'result.error.reason',
  'result.error.recovery',
  'restoration.canUndo',
  'restoration.canRedo',
]);

export interface FieldDiff {
  readonly field: Field;
  readonly a: Json;
  readonly b: Json;
  /** The intended-differences entry that covers it, if any. */
  readonly coveredBy?: IntendedDifference;
}

export interface Divergence {
  readonly step: number;
  readonly pattern: string;
  readonly fields: readonly FieldDiff[];
  /** The highest-priority differing field. */
  readonly primary: FieldDiff;
  readonly aOutcome: Outcome;
  readonly bOutcome: Outcome;
  /** See groupKey(). */
  readonly key: string;
}

export interface Comparison {
  /** The first divergence not covered by an intended difference. */
  readonly uncovered?: Divergence;
  /** Divergences before it whose every field was covered. */
  readonly covered: readonly Divergence[];
}

const absent = null;

/** Summary used in the group key for `result.status`: the status plus what refused. */
export function statusSummary(outcome: Outcome): string {
  if (outcome.status !== 'error') return outcome.status;
  const e = outcome.error;
  return `error:${e.causeKind ?? e.st ?? e.class}`;
}

function flatten(record: StepRecord): Map<Field, Json> {
  const fields = new Map<Field, Json>();
  const { outcome, observation } = record;
  fields.set('result.status', outcome.status);
  if (outcome.status === 'error') {
    const e = outcome.error;
    fields.set('result.error.causeKind', e.causeKind ?? absent);
    fields.set('result.error.class', e.class);
    fields.set('result.error.code', e.code ?? absent);
    fields.set('result.error.st', e.st ?? absent);
    fields.set('result.error.stage', e.stage ?? absent);
    fields.set('result.error.reason', e.reason ?? absent);
    fields.set('result.error.recovery', e.recovery ?? absent);
    fields.set('result.error.message', e.message);
  } else if (outcome.status === 'ok') {
    fields.set('result.value', outcome.value ?? absent);
  }
  const { state } = observation;
  if ('readError' in state) {
    fields.set('state.readError', state.readError as unknown as Json);
  } else {
    fields.set('state.a', state.a);
    fields.set('state.cfg', state.cfg);
    fields.set('state.rows', state.rows);
    fields.set('state.ids', state.ids);
  }
  if (observation.restoration) {
    fields.set('restoration.canUndo', observation.restoration.canUndo);
    fields.set('restoration.canRedo', observation.restoration.canRedo);
    fields.set('restoration.index', observation.restoration.index);
    fields.set('restoration.length', observation.restoration.length);
  }
  fields.set('receipts', observation.receipts as Json);
  fields.set('link.pushes', observation.pushes as unknown as Json);
  fields.set('link.probes', observation.probes as unknown as Json);
  fields.set('treeErrors', observation.treeErrors as unknown as Json);
  fields.set('warnings', observation.warnings as unknown as Json);
  fields.set('asyncErrors', record.asyncErrors as unknown as Json);
  return fields;
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

const isReadError = (value: Json): value is { readError: { class: string } } =>
  typeof value === 'object' && value !== null && !Array.isArray(value) && 'readError' in value;

export function groupValue(field: Field, value: Json): string {
  if (isReadError(value)) return `readError:${value.readError.class}`;
  return ENUM_FIELDS.has(field) ? (typeof value === 'string' ? value : canonical(value)) : '*';
}

/**
 * Group key: pattern, primary field and, for vocabulary fields, both values.
 * A status difference is keyed by what refused (cause kind, [ST####] code or
 * class); one involving `unsupported` is keyed as unsupported vs `*`, so
 * every way the supporting side responds lands in one group.
 */
export function groupKey(pattern: string, primary: FieldDiff, a: Outcome, b: Outcome): string {
  let va = groupValue(primary.field, primary.a);
  let vb = groupValue(primary.field, primary.b);
  if (primary.field === 'result.status') {
    const unsupported = a.status === 'unsupported' || b.status === 'unsupported';
    va = unsupported ? (a.status === 'unsupported' ? 'unsupported' : '*') : statusSummary(a);
    vb = unsupported ? (b.status === 'unsupported' ? 'unsupported' : '*') : statusSummary(b);
  }
  return [pattern, primary.field, va, vb].join(' | ');
}

/**
 * The fields that differ at one step, in priority order. `unsupported` on one
 * side and `skipped` on the other is not a difference: neither did anything.
 */
export function diffStep(a: StepRecord, b: StepRecord): { field: Field; a: Json; b: Json }[] {
  const fa = flatten(a);
  const fb = flatten(b);
  const noOps = new Set([a.outcome.status, b.outcome.status]);
  if (noOps.has('unsupported') && noOps.has('skipped') && noOps.size === 2) {
    fa.set('result.status', 'skipped');
    fb.set('result.status', 'skipped');
  }
  const statusDiffers = fa.get('result.status') !== fb.get('result.status');
  const diffs: { field: Field; a: Json; b: Json }[] = [];
  for (const field of FIELDS) {
    // A differing status already says the result differs; its sub-fields would only repeat it.
    if (statusDiffers && field !== 'result.status' && field.startsWith('result.')) continue;
    if (!fa.has(field) && !fb.has(field)) continue;
    const va = fa.get(field) ?? absent;
    const vb = fb.get(field) ?? absent;
    if (canonical(va) !== canonical(vb)) diffs.push({ field, a: va, b: vb });
  }
  return diffs;
}

export function compareTraces(
  a: Trace,
  b: Trace,
  covers: (pattern: string, field: string) => IntendedDifference | undefined = () => undefined
): Comparison {
  if (a.length !== b.length) throw new Error(`trace lengths differ: ${a.length} vs ${b.length}`);
  const covered: Divergence[] = [];
  for (let i = 0; i < a.length; i++) {
    const ra = a[i] as StepRecord;
    const rb = b[i] as StepRecord;
    const raw = diffStep(ra, rb);
    if (raw.length === 0) continue;
    const pattern = ra.label;
    const fields: FieldDiff[] = raw.map((d) => {
      const coveredBy = covers(pattern, d.field);
      return coveredBy ? { ...d, coveredBy } : d;
    });
    const primary = fields[0] as FieldDiff;
    const divergence: Divergence = {
      step: i,
      pattern,
      fields,
      primary,
      aOutcome: ra.outcome,
      bOutcome: rb.outcome,
      key: groupKey(pattern, primary, ra.outcome, rb.outcome),
    };
    if (fields.every((f) => f.coveredBy)) {
      covered.push(divergence);
      continue;
    }
    return { uncovered: divergence, covered };
  }
  return { covered };
}
