/**
 * `@signal-tree/kernel/internals` — supported seams for tooling, NOT everyday
 * application API.
 *
 *     TOOLING NEEDS A SUPPORTED SEAM. APPLICATION CODE DOES NOT NEED
 *     TRANSACTION HISTORY.
 *
 * ⚠️ The intended dependency is `studio-adapter -> kernel`, never
 * `application business code -> confirmed turn history`. This subpath exists so
 * Studio has a stable contract without `causal-runtime` or the transactions
 * enhancer's storage types becoming public surface.
 */
import type { ISignalTree } from './lib/types';
import { peekInternalTransactionRuntime } from './enhancers/transactions/transactions';
import { getPositionRegistry } from './lib/internals/position-registry';
import type { TreeId } from './lib/internals/position-registry';
import {
  StudioTreeDestroyedError,
  type ConfirmedTurnReader,
} from './lib/internals/confirmed-turn-view';

export { StudioTreeDestroyedError } from './lib/internals/confirmed-turn-view';
export type {
  ConfirmedTurnEffectKind,
  ConfirmedTurnEffectView,
  ConfirmedTurnReader,
  ConfirmedTurnRetention,
  ConfirmedTurnSnapshot,
  ConfirmedTurnView,
} from './lib/internals/confirmed-turn-view';

/**
 * This tree's runtime identity, or `undefined` if it has none.
 *
 * ⚠️ SEPARATE FROM `confirmedTurnReader` ON PURPOSE. A tree built without
 * `transactions()` has no reader, but it is still a distinct tree that a tool
 * may legitimately attach to and key on. Folding identity into the reader would
 * mean a capability-less tree had no identity at all, and two of them would be
 * indistinguishable.
 *
 * Equality and `Map`-key use only — never serialize it. A consumer needing
 * persistence maps this to its own session identity.
 */
export function treeRuntimeId<T>(tree: ISignalTree<T>): TreeId | undefined {
  return getPositionRegistry(tree.$)?.id;
}

/**
 * A read-only window onto one tree's retained committed turns, or `undefined`
 * if this tree has no transaction runtime.
 *
 *     OBSERVATION PEEKS. IT DOES NOT INSTALL.
 *
 * ⚠️ `undefined` is a MEANINGFUL ANSWER — the tree was built without
 * `transactions()`, or has not run one. It is deliberately not "create a
 * runtime so there is something to read": allocating a `TransactionAuthority`
 * because someone LOOKED would violate the rule that an unused observation seam
 * retains nothing, and would make the act of inspecting change what is
 * inspected.
 *
 * Returns a live view: it reads what the enhancer already retains and keeps no
 * history of its own. Repeated calls are cheap and always current.
 */
export function confirmedTurnReader<T>(
  tree: ISignalTree<T>
): ConfirmedTurnReader | undefined {
  const runtime = peekInternalTransactionRuntime(tree);
  if (!runtime) {
    return undefined;
  }

  const destroyed = (tree as unknown as { destroyed?: () => boolean }).destroyed;

  return {
    treeId: treeRuntimeId(tree),
    readConfirmedTurns: () => {
      // Checked per call, not at construction: a reader is legitimately held
      // across a tree's lifetime, and the interesting moment is the read.
      if (destroyed?.() === true) {
        throw new StudioTreeDestroyedError();
      }
      return runtime.readConfirmedTurns();
    },
  };
}
