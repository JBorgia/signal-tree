export type StructuralHistoryEffect =
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
export type CausalWriteMode = 'authoring' | 'realization' | 'inspection';

/**
 * Metadata describing the intent and source of a tree update.
 *
 * Set ambient context for enhancers using `withWriteContext({...}, () => tree.$.x.set(y))`
 * from `@signaltree/core`. Enhancers read the active context via `getActiveWriteContext()`.
 */
export interface UpdateMetadata {
  /** Intent of the update (closed union — adding new intents is a core change). */
  intent?: 'hydrate' | 'reset' | 'bulk' | 'migration' | 'user' | 'system';
  /** Source of the update (closed union). */
  source?: 'serialization' | 'time-travel' | 'devtools' | 'user' | 'system';
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
  causalMode?: CausalWriteMode;
  /** @internal Canonical structural collection effect produced at mutation time. */
  historyEffect?: StructuralHistoryEffect;
  /** Open extension for guardrails' historical custom-key shape. */
  [key: string]: unknown;
}

export interface WriteAttribution {
  intent?: UpdateMetadata['intent'];
  source?: UpdateMetadata['source'];
  transactionId?: number;
  transactionOwner?: object;
  mutationIntent?: UpdateMetadata['mutationIntent'];
  causalMode?: UpdateMetadata['causalMode'];
}

export interface MutationEnvelope<T = unknown> {
  readonly positionId: PositionId;
  readonly path: readonly PropertyKey[];
  readonly ownerPath?: readonly PropertyKey[];
  readonly before: T;
  readonly after: T;
  readonly kind: MutationKind;
  readonly subjectId?: number;
  readonly structural?: StructuralHistoryEffect;
  readonly attribution?: WriteAttribution;
}
