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
  // Indexed by lifetime, in turn order: a scan of every structural effect per
  // effect made rolling back a large replacement quadratic. `sameSubjectScope`
  // still decides within one lifetime (collections can share lifetimes).
  const dominantStructuralEffects = new Map<
    unknown,
    CausalTurn['effects'][number][]
  >();
  for (const effect of turn.effects) {
    if (
      effect.subjectId !== undefined &&
      (effect.structural === 'add' || effect.structural === 'remove')
    ) {
      const candidates = dominantStructuralEffects.get(effect.subjectId);
      if (candidates) candidates.push(effect);
      else dominantStructuralEffects.set(effect.subjectId, [effect]);
    }
  }

  const firstEffectIndexByOwner = new Map<string, number>();
  turn.effects.forEach((effect, index) => {
    const effectKey = rollbackAddressKey(effect);
    if (!firstEffectIndexByOwner.has(effectKey)) {
      firstEffectIndexByOwner.set(effectKey, index);
    }
  });

  return placeFieldReversalsWhileRowsExist(
    turn.effects
      .filter((effect, index) => {
        if (effect.subjectId !== undefined) {
          const dominantStructuralEffect = dominantStructuralEffects
            .get(effect.subjectId)
            ?.find((candidate) => sameSubjectScope(candidate, effect));
          if (
            dominantStructuralEffect &&
            (dominantStructuralEffect === effect ||
              dominantStructuralEffect.structural === 'add' ||
              dominantStructuralEffect.owner !== effect.owner)
          ) {
            return dominantStructuralEffect === effect;
          }
        }

        const effectKey = rollbackAddressKey(effect);
        return firstEffectIndexByOwner.get(effectKey) === index;
      })
      .map((effect) =>
        createPendingRollbackEffect(effect, turn.id, realizationContext)
      )
      .filter(
        (effect) =>
          (effect.plainBranchMembership !== undefined &&
            effect.plainBranchMembership.before !==
              effect.plainBranchMembership.after) ||
          effect.before !== effect.after ||
          (effect.fieldPresence !== undefined &&
            effect.fieldPresence.before !== effect.fieldPresence.after)
      )
  );
}

/** Correct net contribution order without crossing explicit turn boundaries.
 * Callers retain application/direction boundaries by invoking this per application.
 * Mixed add/remove scopes retain their input order; complete target preflight
 * decides admissibility. They include valid public transient placement anchors.
 */
export function placeFieldReversalsWhileRowsExist<T extends ReversalEffect>(
  effects: readonly T[]
): readonly T[] {
  if (effects.length === 0) return effects;
  const segments: T[][] = [];
  let segment: T[] | undefined;
  let previous: number | undefined;
  for (const effect of effects) {
    // Boundaries are the supplied contiguous runs, not ordinal validation.
    // A repeated label later, or undefined beside a numbered run, stays separate.
    if (!segment || !Object.is(previous, effect.turn)) {
      segments.push((segment = []));
      previous = effect.turn;
    }
    segment.push(effect);
  }
  let changed = false;
  const result: T[] = [];
  for (const unit of segments) {
    const rows = new Map<
      PositionId,
      Map<unknown, { kind: 'add' | 'remove'; fields: T[]; mixed: boolean }>
    >();
    const row = (e: T) =>
      (e.structural === 'add' || e.structural === 'remove') &&
      e.subjectId !== undefined;
    const scope = (e: T) => rows.get(e.owner)?.get(e.subjectId);
    for (const e of unit)
      if (row(e)) {
        let owners = rows.get(e.owner);
        if (!owners) rows.set(e.owner, (owners = new Map()));
        const existing = owners.get(e.subjectId);
        if (existing && existing.kind !== e.structural) existing.mixed = true;
        if (!existing)
          owners.set(e.subjectId, {
            kind: e.structural as 'add' | 'remove',
            fields: [],
            mixed: false,
          });
      }
    for (const e of unit)
      if (e.structural === undefined && e.subjectId !== undefined) {
        const entry = scope(e);
        if (entry && !entry.mixed) entry.fields.push(e);
      }
    const ordered: T[] = [];
    for (const e of unit) {
      const candidate = scope(e);
      const entry = candidate?.mixed ? undefined : candidate;
      if (e.structural === undefined && e.subjectId !== undefined && entry)
        continue;
      if (row(e) && e.structural === 'remove' && entry) {
        for (const field of entry.fields) ordered.push(field);
        entry.fields = [];
      }
      ordered.push(e);
      if (row(e) && e.structural === 'add' && entry) {
        for (const field of entry.fields) ordered.push(field);
        entry.fields = [];
      }
    }
    changed ||= ordered.some((effect, index) => effect !== unit[index]);
    for (const effect of ordered) result.push(effect);
  }
  return changed ? result : effects;
}

function rollbackAddressKey(effect: CausalTurn['effects'][number]): string {
  // ⚠️ A MEMBER'S PRESENCE IS ITS OWN ADDRESS. An entity collection's
  // membership effect shares its owner with the collection's row effects; keyed
  // by owner alone, it was dropped as a repeat whenever a row effect came first
  // in the turn. A row-adding write to an omitted collection records its
  // removals first, so rolling it back left the collection present with its
  // retained rows (v16 8e review).
  if (effect.plainBranchMembership !== undefined) {
    return `${String(effect.owner)}\u0000membership`;
  }
  if (effect.subjectFieldSegments !== undefined) {
    return JSON.stringify([
      effect.owner,
      effect.subjectId,
      effect.subjectFieldSegments,
    ]);
  }
  return hasInlineScopedLeafAddress(effect)
    ? `${String(effect.owner)}\u0000${effect.path}`
    : String(effect.owner);
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
      subjectFieldSegments: effect.subjectFieldSegments,
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
      structural,
      structuralContext: effect.structuralContext,
    };
  }

  if (
    effect.plainBranchMembership !== undefined ||
    hasInlineScopedLeafAddress(effect)
  ) {
    return {
      owner: effect.owner,
      before: effect.after,
      after: effect.before,
      subjectId: effect.subjectId,
      subjectFieldSegments: effect.subjectFieldSegments,
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
    subjectFieldSegments: effect.subjectFieldSegments,
    fieldPresence: effect.fieldPresence
      ? {
          before: effect.fieldPresence.after,
          after: effect.fieldPresence.before,
        }
      : undefined,
    structural,
    structuralContext: effect.structuralContext,
  };
}

function hasInlineScopedLeafAddress(
  effect: CausalTurn['effects'][number]
): boolean {
  if (effect.subjectFieldSegments !== undefined) return true;
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
