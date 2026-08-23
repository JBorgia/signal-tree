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

  /**
   * HIST-C2 PROTOTYPE — whether the write was performed inside a restoration
   * designation scope, captured at `notify()` time.
   *
   * Stamped where the write is OBSERVED rather than read where it is recorded,
   * because capture is deferred to the flush microtask and any synchronous
   * ambient flag is already restored by then. This follows the existing
   * precedent for `source` in `path-notifier.ts`, whose comment documents the
   * same trap.
   *
   * @internal Not application API. Applications express "this is an undoable
   *   user operation"; they must never set this field. The public spelling is
   *   chosen separately, and moving this off the public `UpdateMetadata` type is
   *   part of that step.
   */
  restorationDesignated?: boolean;
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
