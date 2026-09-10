import { type StudioTreeId } from '@signal-tree/studio-query';

/**
 * One realized write, as observed. **Deliberately minimal** — FLUSH-0 returned
 * outcome D, so there is no turn, no flush boundary, and no invented operation
 * grouping. Fields are added only when a specific S2 query earns them.
 *
 * ⚠️ `RealizationEffect` ≠ `CausalEffect` ≠ `TransactionTurn`. Those concepts
 * overlap; they are not interchangeable, and S1 stays authoritative for
 * transaction net consequence.
 */
export interface RealizationEffect {
  readonly sequence: number;
  readonly path: string;
  readonly ownerPath: string;
  readonly before: unknown;
  readonly after: unknown;
  readonly origin?: 'external' | 'restoration' | 'devtools' | 'transaction-rollback';
  readonly participation: 'realized';
  /**
   * Present only when existing semantics supplied it. **Never inferred from
   * timing or adjacency** — SUPERSESSION-0 returned WEAK, so adjacency is not
   * causation.
   */
  readonly transactionId?: number;
}

/**
 * ⚠️ `'complete'` means ONLY: among frames observed during this capture, no
 * potentially-semantic frame lacked trustworthy tree ownership.
 *
 * It does NOT mean capture began at tree creation, that no pre-capture events
 * existed, that nothing was evicted, or that every composition is observable.
 * Those are separate axes below, deliberately.
 */
export type ScopeIntegrity = 'complete' | 'incomplete-unscoped-evidence';

export interface RealizationCoverage {
  /**
   * ⚠️ ALWAYS `false`. Studio has no mechanism that can PROVE capture began
   * before any relevant state activity, and "we installed it early" is not
   * proof. The type says `false` so a future change to `boolean` is a
   * deliberate act with a mechanism behind it.
   */
  readonly completeFromTreeStart: false;
  readonly scopeIntegrity: ScopeIntegrity;
  readonly startedAtSequence: number;
}

export interface RealizationRetention {
  readonly capacity: number;
  readonly retained: number;
  /** Captured evidence existed and has since been evicted. */
  readonly truncated: boolean;
  readonly firstRetainedSequence?: number;
  readonly lastRetainedSequence?: number;
}

export interface RealizationCaptureSnapshot {
  readonly treeId: StudioTreeId;
  readonly coverage: RealizationCoverage;
  readonly retention: RealizationRetention;
  /** Only evidence that could be safely attributed to this tree. */
  readonly effects: readonly RealizationEffect[];
}

/**
 * Three states, and an empty history exists in only one of them.
 *
 * ```text
 * unsupported         this composition cannot provide complete observation
 * supported/inactive  available, capture not started
 * supported/active    []  truthfully means "none since capture began"
 * ```
 */
export type RealizationSupport =
  | { readonly state: 'unsupported'; readonly reason: 'leaf-observation-unavailable' }
  | { readonly state: 'supported'; readonly capture: 'inactive' }
  | {
      readonly state: 'supported';
      readonly capture: 'active';
      readonly snapshot: RealizationCaptureSnapshot;
    };
