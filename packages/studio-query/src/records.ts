/**
 * The Studio session record model.
 *
 * These are SESSION records, not kernel records. The kernel's own types stay
 * internal; `@signal-tree/studio-adapter` normalizes into these.
 */

/**
 * Session-stable tree identity.
 *
 *     THE KERNEL'S `TreeId` MUST NEVER APPEAR HERE.
 *
 * ⚠️ Kernel `TreeId` promises equality and `Map`-key identity and NOTHING else —
 * explicitly not persistence, serialization identity, recreation, or
 * cross-process stability. A `.ststudio` bundle that keyed on one would be
 * describing a tree that no longer exists on reload. The adapter owns the
 * mapping from the runtime identity to this one.
 */
export type StudioTreeId = string;

/**
 * What a turn's effects are known to have DONE to state.
 *
 * ⚠️ S1 EMITS ONLY `'committed'`. `pending` and `discarded` are declared so the
 * schema does not have to change when S1P earns them, and must NOT be
 * manufactured before then: a record claiming `pending` that was never observed
 * as pending is a fabricated fact, which is the one thing Studio may not do.
 */
export type StudioDisposition = 'committed' | 'pending' | 'discarded';

/** Structural existence transition, where the effect is one. */
export type StudioStructuralKind = 'add' | 'remove' | 'rekey';

/**
 * One location's NET consequence within a turn.
 *
 * ⚠️ NET, NOT AN ATTEMPT LOG. The kernel coalesces same-location writes inside a
 * transaction to their net effect by design (MO-1B). An intermediate value
 * written and then corrected before commit is ABSENT from this model — not
 * withheld, absent. Studio must answer "which intermediate writes did not
 * survive?" with UNKNOWN, and it has no source from which to answer otherwise.
 */
export interface StudioEffect {
  /**
   * Tree-scoped position identity. NOT unique across trees — see
   * {@link StudioTurn.treeId} and {@link effectKey}.
   */
  readonly owner: number;
  /**
   * Captured address, for reading. NOT semantic identity: resolve an entity
   * through {@link subjectId}, because a subject can move between paths.
   */
  readonly path: string;
  /** Owner (collection) address for {@link path}. */
  readonly ownerPath: string;
  readonly before: unknown;
  readonly after: unknown;
  /** Semantic identity where the effect addresses an entity. */
  readonly subjectId?: unknown;
  readonly structural?: StudioStructuralKind;
}

/** One transaction's observed consequence. */
export interface StudioTurn {
  readonly treeId: StudioTreeId;
  readonly id: number;
  readonly disposition: StudioDisposition;
  readonly effects: readonly StudioEffect[];
  /** Positions that participated — the atomic parcel. */
  readonly participants: readonly number[];
}

/**
 * The only safe key for an effect across a session.
 *
 * ⚠️ `owner` ALONE IS NOT AN IDENTITY. Position ids are allocated from 1 per
 * tree, so two live trees both call their first leaf 1. The process-global path
 * notifier already made exactly this mistake and coalesced two trees' writes
 * into one (NOTIFIER-SCOPE-0). Keying on `owner` alone reproduces that bug
 * inside the inspector.
 */
export function effectKey(treeId: StudioTreeId, owner: number): string {
  return `${treeId}:${owner}`;
}
