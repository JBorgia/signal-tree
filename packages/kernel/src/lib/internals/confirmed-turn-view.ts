import type { TreeId } from './position-registry';

/**
 * @internal The Studio-facing read model for committed transaction history.
 *
 *     EXPOSE SEMANTICS, NOT STORAGE REPRESENTATION.
 *
 * ⚠️ These types deliberately do NOT re-export `TransactionTurnRecord`, which
 * belongs to the transactions enhancer's internal machinery and carries
 * `__`-prefixed storage fields, restoration claim sets and baseline maps. If
 * `confirmedTurns` becomes a ring buffer, or the record grows a field for
 * reclamation, a consumer of this view must not notice.
 */

export type ConfirmedTurnEffectKind = 'set' | 'add' | 'remove' | 'rekey';

export interface ConfirmedTurnEffectView {
  /** Tree-scoped position identity. Not unique across trees. */
  readonly position: number;
  /** Captured address for reading. NOT semantic identity — use `subjectId`. */
  readonly path: string;
  readonly ownerPath: string;
  readonly kind: ConfirmedTurnEffectKind;
  readonly before?: unknown;
  readonly after?: unknown;
  readonly subjectId?: unknown;
}

export interface ConfirmedTurnView {
  readonly id: number;
  readonly positions: readonly number[];
  /**
   * NET consequence per location, never an attempt log — the kernel coalesces
   * same-location writes inside a transaction by design (MO-1B).
   */
  readonly effects: readonly ConfirmedTurnEffectView[];
}

/**
 * What a reader can and cannot say about completeness.
 *
 *     BOUNDED RETENTION IS NOT CAUSAL COMPLETENESS.
 *
 * ⚠️ A consumer must never read "these are the turns" as "these are all the
 * turns that ever happened". `truncated` is DERIVED from the retained ids
 * rather than asserted, so if eviction is ever added to `confirmedTurns` this
 * becomes true on its own instead of silently lying.
 */
export interface ConfirmedTurnRetention {
  readonly truncated: boolean;
  readonly firstAvailableTurnId?: number;
}

export interface ConfirmedTurnSnapshot {
  readonly turns: readonly ConfirmedTurnView[];
  readonly retention: ConfirmedTurnRetention;
}

/**
 * A read-only window onto ONE tree's retained committed turns.
 *
 * Snapshot-based on purpose. There is no `subscribe`: S1 does not need one, and
 * a notification lifecycle would add hot-path fan-out, an ordering contract
 * nothing has investigated, and a second thing to keep alive — all against the
 * zero-cost-when-unused requirement.
 */
/**
 * Thrown when a reader is used after its tree was destroyed.
 *
 *     EMPTY HISTORY AND A DEAD TREE ARE DIFFERENT FACTS.
 *
 * ⚠️ Returning `[]` for a destroyed tree would let a consumer report "nothing
 * happened" about a tree that is simply gone — and an inspector that cannot
 * tell those apart is worse than one that refuses, because the wrong answer
 * looks like a finding. A reader holder snapshots what it needs before
 * releasing the tree.
 */
export class StudioTreeDestroyedError extends Error {
  readonly code = 'STUDIO_TREE_DESTROYED';
  constructor() {
    super(
      'STUDIO_TREE_DESTROYED: this tree was destroyed; its retained ' +
        'transaction history is no longer readable. Empty history and a ' +
        'destroyed tree are different facts, so this refuses rather than ' +
        'returning an empty snapshot.'
    );
    this.name = 'StudioTreeDestroyedError';
  }
}

export interface ConfirmedTurnReader {
  /**
   * Runtime tree identity. Equality and `Map`-key use only — NEVER serialize
   * it. A session that must persist tree identity maps this to its own.
   */
  readonly treeId: TreeId | undefined;
  /**
   * @throws if the tree has been destroyed. Empty history and a dead tree are
   * different facts, and returning `[]` for both would let a consumer report
   * "nothing happened" about a tree that is simply gone.
   */
  readConfirmedTurns(): ConfirmedTurnSnapshot;
}
