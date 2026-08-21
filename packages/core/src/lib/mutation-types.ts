export type StructuralHistoryEffect =
  | {
      kind: 'add';
      subject: number;
      key: string | number;
      value: unknown;
      beforeSubject?: number;
      afterSubject?: number;
      /** Structural ownership positions encompassed by this existence transition. */
      subjectPositions?: readonly PositionId[];
    }
  | {
      kind: 'remove';
      subject: number;
      key: string | number;
      value: unknown;
      beforeSubject?: number;
      afterSubject?: number;
      /** Structural ownership positions encompassed by this existence transition. */
      subjectPositions?: readonly PositionId[];
    }
  | {
      kind: 'rekey';
      subject: number;
      beforeKey: string | number;
      afterKey: string | number;
      /** Structural ownership positions encompassed by this existence transition. */
      subjectPositions?: readonly PositionId[];
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

export type CausalWriteMode = 'authoring' | 'realization';

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