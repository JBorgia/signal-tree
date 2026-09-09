import type { PositionId, StructuralEffect } from '../../types';

export type { PositionId };

export type TurnId = number;
export type TurnState = 'pending' | 'confirmed';
/**
 * WHICH structural transition an effect is, not the effect record itself. The
 * record is `StructuralEffect` in `lib/types` — a subject-keyed
 * `{ kind, subject, key, value, … }` — and the two are different enough that
 * sharing a name shadowed one with the other.
 */
export type StructuralEffectKind = 'add' | 'remove' | 'rekey';

export interface CausalEffect {
  readonly owner: PositionId;
  readonly before: unknown;
  readonly after: unknown;
  readonly subjectId?: unknown;
  /**
   * Captured realization address — REQUIRED, because every live producer sets
   * it on every variant.
   *
   *     A TYPE THAT OMITS A FIELD ITS ONLY PRODUCER ALWAYS SETS FORCES EVERY
   *     PARTY TO LIE ABOUT THE SHAPE.
   *
   * ⚠️ THESE WERE OPTIONAL-BY-OMISSION UNTIL 2026-09-09, AND THE OMISSION HAD
   * ALREADY CAUSED A CORRUPTION. `toCausalEffect` (transactions.ts) sets both
   * on all four variants and cast `as CausalEffect` to do it; `pending-rollback`
   * then cast back out via `as unknown as { path?: unknown }` to read them.
   * With the address invisible to the type, an earlier narrowing sent
   * subject-addressed effects down the address-less branch, the applier resolved
   * the target as the ROW rather than the FIELD, and a field rollback replaced
   * `{ id: 'A', name: 'Alpha' }` with the bare string `'Alpha'`. See
   * `hasInlineScopedLeafAddress`'s doc in `pending-rollback.ts`.
   *
   * ⚠️ NOT SEMANTIC IDENTITY. Used to derive collection context and a
   * subject-relative field address. Resolving a current entity target must go
   * through `subjectId`; a subject can move between paths.
   */
  readonly path: string;
  /** Owner (collection) address for {@link path}. Required for the same reason. */
  readonly ownerPath: string;
  readonly structural?: StructuralEffectKind;
  /**
   * Producer-authored structural information required to realize this
   * existence transition after the original mutation context is gone.
   *
   * This is durable canonical history: an authored structural snapshot.
   */
  readonly structuralContext?: StructuralEffect;
}

export interface CausalTurn {
  readonly id: TurnId;
  readonly effects: readonly CausalEffect[];
  readonly participants: readonly PositionId[];
  readonly state: TurnState;
}

export interface ReversalEffect {
  readonly owner: PositionId;
  readonly before: unknown;
  readonly after: unknown;
  readonly subjectId?: unknown;
  /**
   * Captured realization address.
   *
   * Used to derive collection context and subject-relative field address. It is
   * not semantic identity and must not be used to bypass SubjectId when
   * resolving a current entity target.
   */
  readonly path?: string;
  readonly ownerPath?: string;
  readonly structural?: StructuralEffectKind;
  /** Durable structural recipe carried from canonical history into realization. */
  readonly structuralContext?: StructuralEffect;
}

export interface ConfirmedReversalPlan {
  readonly turnId: TurnId;
  readonly effects: readonly ReversalEffect[];
}

export interface ConfirmedReapplyPlan {
  readonly turnId: TurnId;
  readonly effects: readonly ReversalEffect[];
}

export type ReversalRefusal =
  | { readonly kind: 'outside-boundary' }
  | { readonly kind: 'frontier-blocked' }
  | { readonly kind: 'turn-evicted' }
  | { readonly kind: 'dependency-conflict' }
  | { readonly kind: 'structural-drift' }
  /**
   * RESTORE-P0 P0-C — world-relative divergence.
   *
   * The turn's recorded inverse is only valid while the location still holds
   * what the turn left there. Once a realization (or any later write) has
   * superseded it, replaying the inverse would destroy truth the history system
   * does not own. Carries the detail because a refusal the caller cannot
   * inspect is barely better than a silent one.
   */
  | {
      readonly kind: 'value-drift';
      readonly path: string;
      readonly current: unknown;
      readonly expected: unknown;
    }
  | { readonly kind: 'not-found' };

export type ReversalResult<
  TRefusal extends ReversalRefusal = ReversalRefusal,
> =
  | { readonly ok: true; readonly turnId: TurnId }
  | { readonly ok: false; readonly refusal: TRefusal };
