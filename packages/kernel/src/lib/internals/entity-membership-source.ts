import { getPositionRegistry } from './position-registry';

/**
 * Production seam for entity membership OBSERVATION (read-only tooling).
 *
 *     A DORMANT CAPABILITY IMPOSES NO ACTIVE-STATE MACHINERY.
 *
 * A collection defines only this source. Until `entityMembershipReader` (from
 * `@signal-tree/kernel/internals`) first observes it, the collection's tap is
 * `undefined` and every structural operation pays one optional call. The
 * inventory, the delta derivation, delivery and formatting all live behind
 * the internals entry (`entity-membership-inventory.ts`,
 * `entity-membership-view.ts`) and are bundled only when imported.
 *
 * The producer reports facts at the moment they are true; the observer turns
 * them into deltas:
 *
 *   Facts       a mutation frame committed (its instructions); point deltas,
 *               never a scan of the collection
 *   Open        a structural unit begins; nested units join it
 *   OpenOrder   a bulk unit begins whose membership the observer diffs
 *               (setAll, clear, upsertMany, moveToFront, a reversal target)
 *   Close       the unit ended, before reactive publication. A unit that
 *               throws still closes, so the observer announces exactly what
 *               physically changed (often nothing) and never stays mid-unit.
 */
export const MEMBERSHIP_FACTS = 0;
export const MEMBERSHIP_OPEN = 1;
export const MEMBERSHIP_OPEN_ORDER = 2;
export const MEMBERSHIP_CLOSE = 3;

/** One committed frame instruction, as staged (only structural kinds count). */
export type EntityMembershipInstruction = {
  readonly kind: string;
  readonly subjectId: number;
  readonly key?: string | number;
  readonly fromKey?: string | number;
  readonly toKey?: string | number;
};

export type EntityMembershipTap = (
  phase: number,
  instructions?: readonly EntityMembershipInstruction[]
) => void;

/** What an observer may read from the collection's structural truth. */
export interface EntityMembershipStore {
  activeKeysSnapshot(): readonly (string | number)[];
  subjectIdForKey(key: string | number): number | undefined;
  neighborSubjectsForKey(key: string | number): {
    beforeSubject?: number;
    afterSubject?: number;
  };
  snapshotActiveOrder(keys: (string | number)[], subjectIds: number[]): void;
}

/** Attach the observer's tap; returns the collection's structural truth. */
export type EntityMembershipSource = (
  tap: EntityMembershipTap
) => EntityMembershipStore;

// Symbol storage survives the EntitySignal proxy without exposing a string API.
const SOURCE = Symbol('SignalTree:EntityMembershipSource');

export function defineEntityMembershipSource(
  node: object,
  source: EntityMembershipSource
): void {
  Object.defineProperty(node, SOURCE, { value: source });
}

export function getEntityMembershipSource(
  node: object
): EntityMembershipSource | undefined {
  return (node as { [SOURCE]?: EntityMembershipSource })[SOURCE];
}

const HOLDS = new WeakMap<object, () => () => void>();
const noop = (): void => undefined;

/** @internal The membership reader registers how its delivery is held. */
export function defineEntityMembershipHold(
  registry: object,
  hold: () => () => void
): void {
  HOLDS.set(registry, hold);
}

/**
 * Hold membership listeners for the whole of one reversal, so they run once
 * every collection has installed, in commit order. A no-op until a membership
 * reader exists for this tree.
 */
export function holdEntityMembershipDelivery(root: object): () => void {
  const registry = getPositionRegistry(root);
  return (registry && HOLDS.get(registry)?.()) || noop;
}
