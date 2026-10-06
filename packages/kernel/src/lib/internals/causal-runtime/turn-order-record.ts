import type { CollectionOrderCapture } from '../mutation-capture-runtime';
import type {
  CollectionTransitionTargetBinding,
  FrontierStep,
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
    const { start, end } = composeTurnOrderEndpoints(record.captures, rows);
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
