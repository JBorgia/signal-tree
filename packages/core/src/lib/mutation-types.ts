export type StructuralEffect =
  | {
      kind: 'add';
      subject: number;
      key: string | number;
      value: unknown;
      beforeSubject?: number;
      afterSubject?: number;
      /** Structural ownership positions encompassed by this existence transition. */
    }
  | {
      kind: 'remove';
      subject: number;
      key: string | number;
      value: unknown;
      beforeSubject?: number;
      afterSubject?: number;
      /** Structural ownership positions encompassed by this existence transition. */
    }
  | {
      kind: 'rekey';
      subject: number;
      beforeKey: string | number;
      afterKey: string | number;
      /** Structural ownership positions encompassed by this existence transition. */
    };

export type PositionId = number;

export type MutationKind =
  | 'set'
  | 'update'
  | 'insert'
  | 'remove'
  | 'move'
  | 'rekey'
  | 'replace';

/**
 * How a write participates in SignalTree's causal mechanisms.
 *
 * This is a POLICY dimension and is deliberately independent of `source`, which
 * answers a different question (where the write came from). Two writes with the
 * same origin can participate differently, and two writes with different origins
 * can share a participation — `restoration` and external truth both realize.
 *
 * - `authoring`    application-authored work. Eligible for restoration
 *                  designation, contributes to a transaction, creates dependency
 *                  evidence.
 * - `realization`  established truth or consequence, not newly authored. Never
 *                  becomes an authored turn, but may still create dependency
 *                  evidence (TX-LEDGER C3) and is protected from being
 *                  discarded by a restoration (RESTORE-P0 P0-C).
 * - `inspection`   diagnostic state application — a DevTools jump. Not
 *                  application work and not authoritative truth, so it is
 *                  excluded from restoration admission, transaction
 *                  contribution and dependency admission, and it is not
 *                  protected against being overwritten by a restoration.
 *                  DEVTOOLS-JUMP-0 / 0.1.
 */
export type WriteParticipation = 'authored' | 'realized' | 'inspection';

/**
 * Metadata describing the intent and source of a tree update.
 *
 * Set ambient context for enhancers using `withWriteContext({...}, () => tree.$.x.set(y))`
 * from `@signaltree/core`. Enhancers read the active context via `getActiveWriteContext()`.
 */
export interface WriteMetadata {
  /** Intent of the update (closed union — adding new intents is a core change). */
  intent?: 'hydrate' | 'reset' | 'bulk' | 'migration' | 'user' | 'system';
  /**
   * Origin of the update — where this application came from (closed union).
   *
   * PROVENANCE only. How a write may participate in causal mechanisms is the
   * separate `participation` axis; the two are deliberately independent, so never
   * infer one from the other.
   *
   * An ABSENT origin means ordinary application work. There is no positive
   * `'application'` value: nothing needs to distinguish "no origin recorded"
   * from "authored by the application", and stamping every write to say so
   * would cost the common path for no consumer's benefit.
   *
   * Three spellings were withdrawn in 15.0 because they named no owner:
   * `'system'` was fabricated provenance (the realization adapter's
   * `?? 'system'` fallback, seven sites, deleted); `'user'` duplicated the
   * meaningful absence above; `'serialization'` claimed a provenance nothing
   * ever stamped. A positive origin exists when provenance carries semantic
   * information — not because the union previously admitted the spelling.
   *
   * `'transaction-rollback'` was added by DIAG-JOURNAL-1.1 under that same rule:
   * a compensation write is a realization whose reason to exist is a withdrawn
   * transaction, and a diagnostic reader could not tell it from external truth.
   * It answers only WHY the write exists; WHICH transaction it compensates is
   * `transactionId`, deliberately a separate fact.
   */
  origin?:
    | 'restoration'
    | 'devtools'
    | 'external'
    | 'transaction-rollback';
  /** Suppress guardrails for this update. */
  suppressGuardrails?: boolean;
  /** Optional correlation ID for related updates. */
  correlationId?: string;
  /** Optional timestamp. */
  timestamp?: number;
  /** Internal owner position ids carried by replayed writes. */
  positionIds?: number[];
  /** Internal row subject ids carried by replayed writes. */
  subjectIds?: number[];
  /** @internal Explicit transaction grouping token for Gate 3 attribution. */
  transactionId?: number;
  /** @internal Owning tree token for transaction attribution isolation. */
  transactionOwner?: object;
  /** @internal Declared leaf-write semantics for scalar rollback classification. */
  mutationIntent?: 'replace' | 'derive';
  /** @internal Explicitly distinguishes causal authorship from causal realization. */
  participation?: WriteParticipation;
  /** @internal Canonical structural collection effect produced at mutation time. */
  structuralEffect?: StructuralEffect;
  // MATRIX-CLOSE M7 — THE ESCAPE HATCH IS DELETED.
  //
  //     /** Open extension for guardrails' historical custom-key shape. */
  //     [key: string]: unknown;
  //
  // Three facts, in order of weight:
  //
  // 1. It was ACTIVELY HARMFUL. This is the mechanism that let SEMANTICS-NAMES-1
  //    batch 1's stale `meta.source` reads keep compiling after the field was
  //    renamed — every one of them typechecked as `unknown`. Withdrawing the
  //    signature is what forced the compiler to enumerate all 24 readers, and
  //    leaving it in place means the next rename can hide the same way.
  // 2. NOTHING NEEDS IT. Compiler-verified rather than grepped: with the
  //    signature withdrawn, `npm run typecheck` passes across every package and
  //    the demo (`packages/*/src/**` + `apps/demo/src/**`).
  // 3. Its justification names a package that no longer exists — guardrails was
  //    removed in a4bc5493. The hatch outlived its only stated consumer.
  //
  // Per MATRIX-CLOSE's own rule, an open extension nobody uses is UNPROVEN, not
  // PUBLIC. A third-party enhancer that genuinely needs to carry custom keys can
  // earn a declared field the way `'transaction-rollback'` earned its origin
  // value: by producing a consumer.
}

export interface WriteAttribution {
  intent?: WriteMetadata['intent'];
  origin?: WriteMetadata['origin'];
  transactionId?: number;
  transactionOwner?: object;
  mutationIntent?: WriteMetadata['mutationIntent'];
  participation?: WriteMetadata['participation'];
}

export interface MutationEnvelope<T = unknown> {
  readonly positionId: PositionId;
  readonly path: readonly PropertyKey[];
  readonly ownerPath?: readonly PropertyKey[];
  readonly before: T;
  readonly after: T;
  readonly kind: MutationKind;
  readonly subjectId?: number;
  readonly structural?: StructuralEffect;
  readonly attribution?: WriteAttribution;
}
