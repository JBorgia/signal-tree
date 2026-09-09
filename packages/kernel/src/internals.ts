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
  type ConfirmedTurnEffectView,
  type ConfirmedTurnReader,
  type ConfirmedTurnSnapshot,
  type ConfirmedTurnView,
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
 * Project retained records into the stable view model.
 *
 *     THE PROJECTION LIVES HERE SO IT TREE-SHAKES.
 *
 * ⚠️ This was a method on `TransactionAuthority` until it was measured. Class
 * methods are retained whenever the class is instantiated, and the transactions
 * enhancer always instantiates that one — so every consumer paid +489 B
 * minified / +161 B gzip for a projection most of them never call. Here it is
 * reachable only from a build that imports `@signal-tree/kernel/internals`.
 */
function projectConfirmedTurns(
  records: readonly {
    id: number;
    __positionIds?: number[];
    __effects?: readonly {
      position: number;
      path: string;
      ownerPath: string;
      kind: 'set' | 'add' | 'remove' | 'rekey';
      before?: unknown;
      after?: unknown;
      subject?: unknown;
    }[];
  }[]
): ConfirmedTurnSnapshot {
  const turns: ConfirmedTurnView[] = [];
  for (const record of records) {
    const effects: ConfirmedTurnEffectView[] = [];
    for (const effect of record.__effects ?? []) {
      effects.push({
        position: effect.position,
        path: effect.path,
        ownerPath: effect.ownerPath,
        kind: effect.kind,
        before: 'before' in effect ? effect.before : undefined,
        after: 'after' in effect ? effect.after : undefined,
        subjectId: 'subject' in effect ? effect.subject : undefined,
      });
    }
    turns.push({
      id: record.id,
      positions: [...(record.__positionIds ?? [])],
      effects,
    });
  }

  // DERIVED, not asserted. Turn ids are allocated from 1 and never reused, so a
  // first retained id above 1 means earlier turns are gone. Nothing evicts from
  // `confirmedTurns` today, so this is false — and it starts reporting true on
  // its own if that ever changes.
  const firstAvailableTurnId = turns[0]?.id;
  return {
    turns,
    retention: {
      truncated: firstAvailableTurnId !== undefined && firstAvailableTurnId > 1,
      firstAvailableTurnId,
    },
  };
}

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
      return projectConfirmedTurns(
        runtime.getConfirmedTurnRecords() as never
      );
    },
  };
}
