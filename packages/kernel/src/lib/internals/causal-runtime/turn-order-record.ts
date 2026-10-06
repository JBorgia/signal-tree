import type { CollectionOrderCapture } from '../mutation-capture-runtime';
import { visitTree } from '../visit-tree';
import {
  deriveCollectionOrderDelta,
  unrecordedOrderDelta,
  type CollectionOrderDelta,
  type CollectionTransitionTargetBinding,
  type FrontierStep,
} from './target-transition';
import {
  composeTurnOrderEndpoints,
  type TurnOrderCapture,
  type TurnRows,
} from './net-order-delta';
import { transientRowsOf } from './transient-rows';

/**
 * A turn's order changes on each collection, as its capture records them:
 * the first frontier before and last frontier after any operation (from the
 * per-operation frontier transitions), and the surviving-row reorders with
 * their orders, in time order. At drain, a collection with reorders gets ONE
 * order change whose orders are the turn's own start and end
 * (`composeTurnOrderEndpoints`); a collection without gets its frontier
 * transition only, so a reversal can reinstate the token it replaced.
 */
export type TurnOrderRecord = {
  readonly owner: number;
  readonly ownerPath: string;
  readonly beforeFrontier: unknown;
  afterFrontier: unknown;
  readonly captures: TurnOrderCapture[];
};

export type TurnOrderChange = {
  readonly owner: number;
  readonly ownerPath: string;
  readonly beforeSubjects: readonly number[];
  readonly afterSubjects: readonly number[];
  readonly beforeFrontier: unknown;
  readonly afterFrontier: unknown;
  /** Its orders could not be composed: kept, refusing to reverse. */
  readonly unrecorded?: true;
};

export type TurnFrontierTransition = {
  readonly owner: number;
  readonly before: unknown;
  readonly after: unknown;
};

export function recordOrderTransition(
  records: Map<number, TurnOrderRecord>,
  capture: CollectionOrderCapture
): void {
  let record = records.get(capture.owner);
  if (!record) {
    record = {
      owner: capture.owner,
      ownerPath: capture.ownerPath,
      beforeFrontier: capture.beforeFrontier,
      afterFrontier: capture.afterFrontier,
      captures: [],
    };
    records.set(capture.owner, record);
  }
  record.afterFrontier = capture.afterFrontier;
  if (capture.beforeSubjects && capture.afterSubjects) {
    record.captures.push({
      beforeSubjects: [...capture.beforeSubjects],
      afterSubjects: [...capture.afterSubjects],
      beforeFrontier: capture.beforeFrontier,
      afterFrontier: capture.afterFrontier,
    });
  }
}

type RowEffect = {
  readonly kind: string;
  readonly position: number;
  readonly subject?: number;
  readonly beforeSubject?: number;
  readonly afterSubject?: number;
};

/**
 * The turn's order changes and frontier transitions. `effects` are the
 * capture's own (before ghost rows are appended); `capture` is the effect
 * map transient rows were recorded against. Call before forgetting them.
 */
export function drainTurnOrders(
  records: ReadonlyMap<number, TurnOrderRecord>,
  effects: readonly RowEffect[],
  capture: object
): { changes: TurnOrderChange[]; frontiers: TurnFrontierTransition[] } {
  const changes: TurnOrderChange[] = [];
  const frontiers: TurnFrontierTransition[] = [];
  if (records.size === 0) return { changes, frontiers };
  const transients = transientRowsOf(capture);
  for (const record of records.values()) {
    if (record.captures.length === 0) {
      if (record.beforeFrontier !== record.afterFrontier) {
        frontiers.push({
          owner: record.owner,
          before: record.beforeFrontier,
          after: record.afterFrontier,
        });
      }
      continue;
    }
    const anchors = (effect: RowEffect) => ({
      beforeSubject: effect.beforeSubject,
      afterSubject: effect.afterSubject,
    });
    const rows: TurnRows = {
      created: effects
        .filter(
          (effect) => effect.kind === 'add' && effect.position === record.owner
        )
        .map((effect) => ({
          subject: effect.subject as number,
          anchors: anchors(effect),
        })),
      removed: effects
        .filter(
          (effect) =>
            effect.kind === 'remove' && effect.position === record.owner
        )
        .map((effect) => ({
          subject: effect.subject as number,
          anchors: anchors(effect),
        })),
      transient: transients
        .filter(({ add }) => add.position === record.owner)
        .map(({ add, remove }) => ({
          subject: add.subject,
          created: anchors(add),
          removed: anchors(remove),
        })),
    };
    let endpoints: { start: number[]; end: number[] };
    try {
      endpoints = composeTurnOrderEndpoints(record.captures, rows);
    } catch {
      // Contradictory records. Never thrown out of a capture's drain (a
      // transaction's callback has committed by now, and a flush swallows
      // errors and would lose the turn): kept as an UNRECORDED change, whose
      // reversal refuses.
      changes.push({
        owner: record.owner,
        ownerPath: record.ownerPath,
        beforeSubjects: [],
        afterSubjects: [],
        beforeFrontier: record.beforeFrontier,
        afterFrontier: record.afterFrontier,
        unrecorded: true,
      });
      continue;
    }
    const { start, end } = endpoints;
    if (
      start.length === end.length &&
      start.every((subject, index) => subject === end[index])
    ) {
      // Reorders that cancel: no order change, only its token transition.
      if (record.beforeFrontier !== record.afterFrontier) {
        frontiers.push({
          owner: record.owner,
          before: record.beforeFrontier,
          after: record.afterFrontier,
        });
      }
      continue;
    }
    changes.push({
      owner: record.owner,
      ownerPath: record.ownerPath,
      beforeSubjects: start,
      afterSubjects: end,
      beforeFrontier: record.beforeFrontier,
      afterFrontier: record.afterFrontier,
    });
  }
  return { changes, frontiers };
}

/** Every collection's transition binding under `root`, by owner. */
export function transitionBindingsOf(
  root: object
): Map<number, CollectionTransitionTargetBinding> {
  const bindings = new Map<number, CollectionTransitionTargetBinding>();
  visitTree(root as never, (node) => {
    const binding = (
      node as { __prepareTransitionTarget?: CollectionTransitionTargetBinding }
    ).__prepareTransitionTarget;
    if (binding) bindings.set(binding.owner, binding);
    return undefined;
  });
  return bindings;
}

/**
 * A TOKEN-ONLY transition settles at once. A turn that replaced a
 * collection's order token without changing its rows or their order (a row
 * added and removed again, reorders that cancel, a move to where a row
 * already was) leaves exactly the order the earlier token named, so the
 * collection gets that token back now, and the turn records nothing for it.
 * Recorded instead, it was a link only this turn could undo: if it recorded
 * no entry, or stood as a gap, an earlier order change could never reverse.
 *
 * Token-only means no row of the collection was added or removed in the
 * turn (`effects`, net) and no reorder was recorded (`frontiers` holds
 * transitions without one). Settled where the collection still holds the
 * turn's token; kept otherwise (later work moved it, or another capture of
 * the same turn settled it already): the chain through it still holds.
 */
export function settleTokenOnly(
  frontiers: readonly TurnFrontierTransition[],
  effects: Iterable<{ readonly kind: string; readonly position: number }>,
  bindings: () => ReadonlyMap<number, CollectionTransitionTargetBinding>
): TurnFrontierTransition[] {
  if (frontiers.length === 0) return [];
  const membershipChanged = new Set<number>();
  for (const { kind, position } of effects) {
    if (kind === 'add' || kind === 'remove') membershipChanged.add(position);
  }
  let resolved:
    | ReadonlyMap<number, CollectionTransitionTargetBinding>
    | undefined;
  return frontiers.filter((transition) => {
    if (membershipChanged.has(transition.owner)) return true;
    resolved ??= bindings();
    const binding = resolved.get(transition.owner);
    const live = binding?.orderFrontier?.();
    if (binding === undefined || live === undefined) return true;
    if (live !== transition.after) return true;
    binding.orderFrontier?.(transition.before as object);
    return false;
  });
}

/**
 * A turn's order changes as order deltas (an unrecorded change as such).
 * `drainTurnOrders` already made a change whose orders are the same at both
 * ends (reorders that cancel) a frontier transition: an empty delta dropped
 * here once took the token transition with it, and an earlier order change
 * could no longer reverse.
 */
export function turnOrderDeltas(
  changes: readonly TurnOrderChange[],
  explicitOf: (owner: number) => ReadonlySet<number> | undefined = () =>
    undefined
): CollectionOrderDelta[] {
  return changes.map((change) =>
    change.unrecorded
      ? unrecordedOrderDelta(
          change.owner,
          change.beforeFrontier,
          change.afterFrontier
        )
      : deriveCollectionOrderDelta(
          change.owner,
          change.beforeSubjects,
          change.afterSubjects,
          change.beforeFrontier,
          change.afterFrontier,
          explicitOf(change.owner)
        )
  );
}

/**
 * (d) Reinstating the token on reversal. A turn's frontier transition on a
 * collection, oriented by the reversal: undo moves `after` -> `before`, redo
 * the other way.
 */
export function frontierStepOf(
  transition: TurnFrontierTransition,
  direction: 'undo' | 'redo'
): FrontierStep {
  return direction === 'undo'
    ? { owner: transition.owner, from: transition.after, to: transition.before }
    : {
        owner: transition.owner,
        from: transition.before,
        to: transition.after,
      };
}

/**
 * Steps (in application order) chained per collection: one step from the
 * first one's source token to the last one's target token. Where two
 * consecutive steps do not meet, something unrecorded changed the order
 * between them (a gap standing between the turns), so nothing is reinstated
 * and the collection gets a fresh token, as any unproven order does.
 */
export function chainFrontierSteps(
  steps: Iterable<FrontierStep>
): FrontierStep[] {
  const chained = new Map<number, FrontierStep>();
  for (const step of steps) {
    const existing = chained.get(step.owner);
    if (!existing) chained.set(step.owner, { ...step });
    else existing.to = existing.to === step.from ? step.to : undefined;
  }
  return [...chained.values()];
}

/**
 * For a reversal that does not derive a declarative target: reads each
 * collection's frontier now; calling the result after the reversal applied
 * reinstates `to` where the collection was at `from` (it then holds exactly
 * the order `to` identified).
 */
export function prepareFrontierReinstatement(
  steps: readonly FrontierStep[],
  bindingOf: (owner: number) => CollectionTransitionTargetBinding | undefined
): () => void {
  const due = steps.filter(
    (step) =>
      step.to !== undefined &&
      bindingOf(step.owner)?.orderFrontier?.() === step.from
  );
  return () => {
    for (const step of due) {
      bindingOf(step.owner)?.orderFrontier?.(step.to as object);
    }
  };
}
