// O1 | **Fine-grained observation.** A reader re-runs only when a location it
// read changed (as defined in T4). A write the seam skips as unchanged re-runs
// nothing. A row or `byId` reader does not re-run for writes to other rows.
//
// Readers are `observe` observers (model.ts Reader); what each reads is
// analysis.ts readerReads: a leaf itself, a field reader its field and its
// row's existence, all() every row location, ids() and count() every row's
// existence. "Changed (as defined in T4)" is a touch: a write the seam does
// not skip.
//
// Checked per turn group (a step and the same-tick steps before it, so a
// notification deferred to the drain is still counted with its turn). When
// the group wrote and touched nothing a reader reads, the reader must not
// run in it; that covers a seam-skipped write to the reader's own location
// and a write to another row. Only groups whose touches are fully seen are
// checked: every step's writes reproduce its state (analysis.ts Touches) and
// none is an undo, redo, rollback, confirm, link traffic other than a pushed
// value, an awaiting scope or destroy, whose writes the vocabulary does not
// name. A field reader is checked only while its row keeps the existence it
// had when the reader opened (observerValidUntil).
//
// The row says when a reader may re-run, not that it must; a reader that
// never runs is not a violation of this row.
import type { Op } from '../model.js';
import { formatReader } from '../model.js';
import {
  analyze,
  isRowLoc,
  observerValidUntil,
  readerReads,
  rowKeyOf,
  writeTargets,
  type Analysis,
  type Loc,
  type StepInfo,
} from './analysis.js';
import { instanceProperty, verdict, type Instance } from './types.js';

export const ROW =
  '**Fine-grained observation.** A reader re-runs only when a location it read changed (as defined in T4). A write the seam skips as unchanged re-runs nothing. A row or `byId` reader does not re-run for writes to other rows.';

/** Operations whose touches the vocabulary fully names, or that write nothing. */
const SEEN = new Set<Op['kind']>([
  'write',
  'transact',
  'declare',
  'linkPush',
  'rowHeldWrite',
  'inspect',
  'rowHold',
  'rowHeldRead',
  'linkSettled',
  'linkDispose',
  'observerOpen',
  'observe',
  'hydrate',
]);
const WRITES = new Set<Op['kind']>(['write', 'transact', 'declare', 'linkPush', 'rowHeldWrite']);

/** Steps grouped into turns: each group ends at a step that is not same-tick. */
export function turnGroups(analysis: Analysis): StepInfo[][] {
  const groups: StepInfo[][] = [];
  let current: StepInfo[] = [];
  for (const s of analysis.steps) {
    current.push(s);
    if (!analysis.trace.sequence.steps[s.index]?.sameTick) {
      groups.push(current);
      current = [];
    }
  }
  if (current.length) groups.push(current);
  return groups;
}

/** How often observer `observer` ran in the given steps. */
export const runsIn = (steps: readonly StepInfo[], observer: number): number =>
  steps.reduce((n, s) => n + (s.observation.observerEvents ?? []).filter((e) => e.kind === 'run' && e.observer === observer).length, 0);

/** Locations a step's own writes name (whatever they end up touching). */
function named(s: StepInfo): Loc[] {
  const { op } = s;
  const writes = op.kind === 'write' ? [op.write] : op.kind === 'transact' || op.kind === 'declare' ? op.body : [];
  return writes.flatMap((w) => [...writeTargets(w).locs]);
}

export const O1 = instanceProperty({
  id: 'O1',
  row: ROW,
  reason: 'The published packages subscribe leaves, row fields and (v15) collection readers; a whole-row byId reader cannot be subscribed, so the row clause is checked through field readers.',
  instances(trace) {
    const analysis = analyze(trace);
    const found: Instance[] = [];
    const valid = analysis.observers.map((o) => observerValidUntil(analysis, o));
    for (const group of turnGroups(analysis)) {
      const first = group[0] as StepInfo;
      const last = group[group.length - 1] as StepInfo;
      if (!group.some((s) => WRITES.has(s.op.kind) && s.outcome.status === 'ok')) continue;
      if (group.some((s) => s.unknown || !s.touches || !SEEN.has(s.op.kind) || s.touches.maybe.size > 0)) continue;
      const touched = new Set(group.flatMap((s) => [...(s.touches?.sure ?? [])]));
      const names = group.flatMap((s) => (s.outcome.status === 'ok' ? named(s) : []));
      for (const o of analysis.observers) {
        if (o.step >= first.index || last.index >= (valid[o.index] ?? Infinity)) continue;
        if ([...touched].some((loc) => readerReads(o.reader, loc))) continue;
        const runs = runsIn(group, o.index);
        const skipped = names.some((loc) => readerReads(o.reader, loc));
        const { reader } = o;
        const otherRow = reader.kind === 'field' && [...touched].some((loc) => isRowLoc(loc) && rowKeyOf(loc) !== reader.id);
        found.push(
          verdict(
            runs === 0,
            last.index,
            skipped ? 'ran-for-skipped-write' : otherRow ? 'ran-for-other-row' : 'ran-for-unread-location',
            { reader: formatReader(o.reader), runs: 0 },
            { reader: formatReader(o.reader), runs, touched: [...touched] },
            `observer ${o.index} on ${formatReader(o.reader)} in the turn ending at step ${last.index}, which touched ${
              [...touched].join(', ') || 'nothing'
            }`
          )
        );
      }
    }
    return found;
  },
});
