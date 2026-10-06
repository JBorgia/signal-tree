import { plainBranchMemberEffectIsNoop } from '../plain-branch-membership';
import { appendAll } from '../utilities/append-all';
import type { PositionRegistry } from '../position-registry';

import type {
  PositionId,
  ReversalEffect,
  ReversalResult,
  TurnId,
  CausalTurn,
} from './causal-types';
import type { EffectApplicationPort } from './effect-applier';
import type { RealizationContext } from './realization-context';
import type { PreparePendingTurnDiscardResult, TurnStore } from './turn-store';

export type RollbackPendingResult = ReversalResult<
  | { readonly kind: 'outside-boundary' }
  | { readonly kind: 'dependency-conflict' }
  | { readonly kind: 'turn-evicted' }
  | { readonly kind: 'structural-drift' }
>;

export interface PendingRollbackPort extends EffectApplicationPort {
  validateEffects?(
    effects: readonly ReversalEffect[]
  ):
    | Extract<RollbackPendingResult, { readonly ok: false }>['refusal']
    | undefined;
}

export interface RollbackPendingTurnAtOptions {
  readonly authority: PositionId;
  readonly turnId: TurnId;
  readonly store: Pick<
    TurnStore,
    | 'commitPreparedDiscardPending'
    | 'getPendingTurn'
    | 'getPendingTurns'
    | 'getTurns'
    | 'prepareDiscardPendingTurn'
  >;
  readonly topology: Pick<PositionRegistry, 'contains'>;
  readonly port: PendingRollbackPort;
  readonly realizationContext: RealizationContext;
  readonly onMaintenanceMayBeUseful?: (turn: CausalTurn) => void;
  readonly reportMaintenanceObserverError?: (
    error: unknown,
    turn: CausalTurn
  ) => void;
  readonly onPendingTurnDiscarded?: (turn: CausalTurn) => void;
  readonly reportDiscardObserverError?: (
    error: unknown,
    turn: CausalTurn
  ) => void;
}

export function rollbackPendingTurnAt(
  options: RollbackPendingTurnAtOptions
): RollbackPendingResult {
  const turn = options.store.getPendingTurn(options.turnId);
  if (!turn) {
    return { ok: false, refusal: { kind: 'turn-evicted' } };
  }

  if (
    !turn.participants.every((participant) =>
      options.topology.contains(options.authority, participant)
    )
  ) {
    return { ok: false, refusal: { kind: 'outside-boundary' } };
  }

  if (hasLaterStructuralDependency(turn, options.store)) {
    return { ok: false, refusal: { kind: 'dependency-conflict' } };
  }

  const effects = createPendingRollbackEffects(
    turn,
    options.realizationContext
  );
  const validationRefusal = options.port.validateEffects?.(effects);
  if (validationRefusal) {
    return { ok: false, refusal: validationRefusal };
  }

  const transition = options.store.prepareDiscardPendingTurn(turn.id);
  if (!transition.ok) {
    return mapDiscardFailure(transition);
  }

  options.port.applyAtomically(effects);
  const discardedTurn = options.store.commitPreparedDiscardPending(
    transition.transition
  );

  const maintenanceObserver =
    options.onMaintenanceMayBeUseful ?? options.onPendingTurnDiscarded;
  const maintenanceErrorObserver =
    options.reportMaintenanceObserverError ??
    options.reportDiscardObserverError;

  if (discardedTurn && maintenanceObserver) {
    try {
      maintenanceObserver(discardedTurn);
    } catch (error) {
      if (maintenanceErrorObserver) {
        maintenanceErrorObserver(error, discardedTurn);
      } else {
        queueMicrotask(() => {
          throw normalizeError(error);
        });
      }
    }
  }

  return { ok: true, turnId: turn.id };
}

function createPendingRollbackEffects(
  turn: CausalTurn,
  realizationContext: RealizationContext
): readonly ReversalEffect[] {
  const dominantStructuralEffects: CausalTurn['effects'][number][] = [];
  for (const effect of turn.effects) {
    if (
      effect.subjectId !== undefined &&
      (effect.structural === 'add' || effect.structural === 'remove')
    ) {
      dominantStructuralEffects.push(effect);
    }
  }

  const firstEffectIndexByOwner = new Map<string, number>();
  const keyOf = (effect: CausalTurn['effects'][number]): string =>
    effect.fieldSegments !== undefined
      ? JSON.stringify([effect.owner, effect.subjectId, effect.fieldSegments])
      : hasInlineScopedLeafAddress(effect)
      ? JSON.stringify([effect.owner, effect.subjectId, effect.path])
      : String(effect.owner);
  turn.effects.forEach((effect, index) => {
    const effectKey = keyOf(effect);
    if (!firstEffectIndexByOwner.has(effectKey)) {
      firstEffectIndexByOwner.set(effectKey, index);
    }
  });

  return placeFieldReversalsWhileRowsExist(
    turn.effects
      .filter((effect, index) => {
        if (effect.subjectId !== undefined) {
          const dominantStructuralEffect = dominantStructuralEffects.find(
            (candidate) => sameSubjectScope(candidate, effect)
          );
          // An `add` created the subject in this turn, so removing it reverses
          // everything the turn did to it. A `remove` does NOT dominate the
          // writes to the row it removed (same owner and lifetime): its re-add
          // restores the row AS REMOVED, so those writes still have to be
          // reversed. Dropping them rolled update-then-remove back to the
          // UPDATED row (npm 15.4.3). The re-add once rebuilt the pre-turn
          // fields itself (`deriveSubjectState`, deleted in 896ab368 with the
          // subject-position transport); nothing replaced it until this.
          if (
            dominantStructuralEffect &&
            (dominantStructuralEffect === effect ||
              dominantStructuralEffect.structural === 'add' ||
              dominantStructuralEffect.owner !== effect.owner)
          ) {
            return dominantStructuralEffect === effect;
          }
        }

        const effectKey = keyOf(effect);
        return firstEffectIndexByOwner.get(effectKey) === index;
      })
      .map((effect) =>
        createPendingRollbackEffect(effect, turn.id, realizationContext)
      )
      .filter((effect) => !plainBranchMemberEffectIsNoop(effect))
  );
}

/**
 * Orders a reversal so every field reversal lands while its row EXISTS: after
 * the row's re-add, before the row's removal. Capture order is not usable for
 * this. A field write precedes the removal it is reversed across, composition
 * can leave a removal in an earlier slot (rekey then remove keeps the rekey's),
 * and a row created in the turn is REMOVED by its reversal after being written.
 * A field reversal outside its row's lifetime reaches a row that is not there:
 * undo/rollback refused ("structural-drift", "Value effect has no active
 * subject").
 *
 * Scoped by owner AND lifetime: lifetimes are allocated per collection, so a
 * bare lifetime would attach one collection's field reversal to another's row.
 * Everything else keeps its relative order.
 */
export function placeFieldReversalsWhileRowsExist<T extends ReversalEffect>(
  effects: readonly T[]
): readonly T[] {
  const rows = new Map<string, T[]>();
  const scopeOf = (effect: T) => `${effect.owner}\u0000${effect.subjectId}`;
  const isRowEffect = (effect: T) =>
    (effect.structural === 'add' || effect.structural === 'remove') &&
    effect.subjectId !== undefined;
  for (const effect of effects) {
    if (isRowEffect(effect)) {
      const scope = scopeOf(effect);
      if (!rows.has(scope)) rows.set(scope, []);
    }
  }
  if (rows.size === 0) return effects;
  const followersOf = (effect: T): T[] | undefined =>
    effect.structural === undefined && effect.subjectId !== undefined
      ? rows.get(scopeOf(effect))
      : undefined;
  for (const effect of effects) followersOf(effect)?.push(effect);
  const ordered: T[] = [];
  for (const effect of effects) {
    if (followersOf(effect)) continue;
    const scope = isRowEffect(effect) ? scopeOf(effect) : undefined;
    if (scope !== undefined && effect.structural === 'remove') {
      appendAll(ordered, rows.get(scope) ?? []);
      rows.set(scope, []);
    }
    ordered.push(effect);
    if (scope !== undefined && effect.structural === 'add') {
      appendAll(ordered, rows.get(scope) ?? []);
      // Unreachable today: neither caller adds or removes one scope twice. If
      // one ever does, ALL of that scope's followers are consolidated at its
      // FIRST add/remove, whatever their capture position — a follower
      // captured after a later one is emitted before it — and none twice.
      rows.set(scope, []);
    }
  }
  return ordered;
}

function createPendingRollbackEffect(
  effect: CausalTurn['effects'][number],
  turnId: TurnId,
  realizationContext: RealizationContext
): ReversalEffect {
  const structural = deriveCompensationStructuralEffect(effect.structural);

  if (effect.structural !== undefined) {
    return {
      owner: effect.owner,
      before: deriveStructuralRollbackBefore(effect),
      after: deriveStructuralRollbackAfter(effect),
      subjectId: effect.subjectId,
      structural,
      structuralContext: effect.structuralContext,
    };
  }

  if (
    effect.plainBranchMembership !== undefined ||
    effect.fieldSegments !== undefined ||
    hasInlineScopedLeafAddress(effect)
  ) {
    return {
      owner: effect.owner,
      before: effect.after,
      after: effect.before,
      subjectId: effect.subjectId,
      fieldSegments: effect.fieldSegments,
      plainBranchMembership: effect.plainBranchMembership
        ? {
            before: effect.plainBranchMembership.after,
            after: effect.plainBranchMembership.before,
          }
        : undefined,
      fieldPresence: effect.fieldPresence
        ? {
            before: effect.fieldPresence.after,
            after: effect.fieldPresence.before,
          }
        : undefined,
      path: effect.path,
      ownerPath: effect.ownerPath,
      structural,
      structuralContext: effect.structuralContext,
    };
  }

  return {
    owner: effect.owner,
    before: realizationContext.getCurrentValue(effect.owner),
    after: realizationContext.getValueWithoutPendingTurn(turnId, effect.owner),
    subjectId: effect.subjectId,
    structural,
    structuralContext: effect.structuralContext,
  };
}

function hasInlineScopedLeafAddress(
  effect: CausalTurn['effects'][number]
): boolean {
  // `path`/`ownerPath` are REQUIRED on CausalEffect as of 2026-09-09, so this
  // no longer probes for their presence through a double cast — it asks the one
  // question that was ever semantic: is this a SCOPED LEAF address (a field
  // inside a collection member) rather than the collection itself?
  //
  // ⚠️ DO NOT RE-ADD `effect.subjectId === undefined` HERE.
  //
  // It was here, and it silently corrupted every entity FIELD rollback. An
  // entity field write legitimately carries BOTH a subject id and a scoped leaf
  // address — the capture records exactly this:
  //
  //     { owner: 2, before: 'Alpha', after: 'Changed',
  //       subjectId: 1, path: 'rows.A.name', ownerPath: 'rows' }
  //
  // Excluding subject-addressed effects sent it to the address-less branch
  // below, which drops `path`/`ownerPath`. The applier then had only a subject
  // id, resolved the target as the ROW, and wrote the FIELD's previous value
  // into it — the row became the bare string 'Alpha' instead of
  // `{ id: 'A', name: 'Alpha' }`.
  //
  // The two are not alternatives: `hasInlineSubjectAddress` on the applier side
  // REQUIRES both together, and `reversal-planner.ts` (the undo path) has always
  // carried both unconditionally. That is why `undo()` was correct and
  // `rollback()` was not, and the difference was this one condition.
  //
  // See transactions-documented-defects.spec.ts.
  return effect.structural === undefined && effect.path !== effect.ownerPath;
}

function deriveStructuralRollbackBefore(
  effect: CausalTurn['effects'][number]
): unknown {
  switch (effect.structural) {
    case 'add':
    case 'rekey':
      return effect.after;
    case 'remove':
      return effect.after;
    default:
      return effect.before;
  }
}

function deriveStructuralRollbackAfter(
  effect: CausalTurn['effects'][number]
): unknown {
  switch (effect.structural) {
    case 'add':
      return effect.before;
    case 'remove':
    case 'rekey':
      return effect.before;
    default:
      return effect.after;
  }
}

function hasLaterStructuralDependency(
  pendingTurn: CausalTurn,
  store: Pick<TurnStore, 'getPendingTurns' | 'getTurns'>
): boolean {
  const laterTurns = [...store.getTurns(), ...store.getPendingTurns()].filter(
    (turn) => turn.id > pendingTurn.id
  );

  return pendingTurn.effects.some((pendingEffect) => {
    if (!pendingEffect.structural || !pendingEffect.subjectId) {
      return false;
    }

    if (pendingEffect.structural === 'add') {
      return laterTurns.some((turn) =>
        turn.effects.some((effect) => sameSubjectScope(effect, pendingEffect))
      );
    }

    const restoredStructuralResource =
      getRestoredStructuralResource(pendingEffect);
    if (
      restoredStructuralResource !== undefined &&
      laterTurns.some((turn) =>
        turn.effects.some(
          (effect) =>
            getAcquiredStructuralResource(effect) ===
              restoredStructuralResource &&
            sameStructuralScope(effect, pendingEffect)
        )
      )
    ) {
      return true;
    }

    return laterTurns.some((turn) =>
      turn.effects.some(
        (effect) =>
          effect.structural !== undefined &&
          sameSubjectScope(effect, pendingEffect)
      )
    );
  });
}

function sameSubjectScope(
  left: CausalTurn['effects'][number],
  right: CausalTurn['effects'][number]
): boolean {
  if (left.subjectId !== right.subjectId) {
    return false;
  }
  const leftOwnerPath = (left as { ownerPath?: unknown }).ownerPath;
  const rightOwnerPath = (right as { ownerPath?: unknown }).ownerPath;
  return typeof leftOwnerPath === 'string' && typeof rightOwnerPath === 'string'
    ? leftOwnerPath === rightOwnerPath
    : true;
}

function sameStructuralScope(
  left: CausalTurn['effects'][number],
  right: CausalTurn['effects'][number]
): boolean {
  const leftOwnerPath = (left as { ownerPath?: unknown }).ownerPath;
  const rightOwnerPath = (right as { ownerPath?: unknown }).ownerPath;
  return typeof leftOwnerPath === 'string' && typeof rightOwnerPath === 'string'
    ? leftOwnerPath === rightOwnerPath
    : left.owner === right.owner;
}

function getRestoredStructuralResource(
  effect: CausalTurn['effects'][number]
): unknown {
  switch (effect.structural) {
    case 'remove':
    case 'rekey':
      return effect.before;
    default:
      return undefined;
  }
}

function getAcquiredStructuralResource(
  effect: CausalTurn['effects'][number]
): unknown {
  switch (effect.structural) {
    case 'add':
    case 'rekey':
      return effect.after;
    default:
      return undefined;
  }
}

function deriveCompensationStructuralEffect(
  structural: CausalTurn['effects'][number]['structural']
): CausalTurn['effects'][number]['structural'] {
  switch (structural) {
    case 'add':
      return 'remove';
    case 'remove':
      return 'add';
    case 'rekey':
      return 'rekey';
    default:
      return undefined;
  }
}

function mapDiscardFailure(
  result: Extract<PreparePendingTurnDiscardResult, { readonly ok: false }>
): RollbackPendingResult {
  if (result.reason === 'turn-evicted') {
    return { ok: false, refusal: { kind: 'turn-evicted' } };
  }

  return { ok: false, refusal: { kind: 'turn-evicted' } };
}

function normalizeError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  return new Error(String(error));
}
