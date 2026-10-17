import type { ISignalTree } from '../../lib/types';
import { SignalTreeRollbackError } from '../../lib/types';
import type {
  PendingTransaction,
  TransactionInspection,
  TransactionMethods,
  TransactionsConfig,
} from './transactions.types';
import { nativeOwnershipExperiment } from '../../lib/internals/native-ownership-driver-experiment';
import { getTreeScalarSlotRuntime } from '../../lib/internals/tree-scalar-slot-port';
import { getPositionRegistry } from '../../lib/internals/position-registry';
import {
  withWriteContext,
  getActiveWriteContext,
} from '../../lib/write-context';
import { getPathNotifier } from '../../lib/path-notifier';
import {
  installTransactionLifecycleChannel,
  getTransactionLifecycleChannel,
} from '../../lib/internals/causal-runtime/transaction-lifecycle';
import {
  defineTransactionLifecycleSource,
  type TransactionLifecycleObserver,
  type TransactionLifecycleFact,
  type PendingTransactionFacts,
} from '../../lib/internals/transaction-lifecycle-source';
import {
  openCommitScope,
  settleCommitScope,
  cancelCommitScopes,
} from '../../lib/internals/commit-consequence';

type Controls = {
  readonly authority: 'native-pending';
  failPreparation(error: unknown, after?: number): void;
  failInspection(error: unknown): void;
  stats(): { pending: number; ledgers: number };
};
const controls = new WeakMap<object, Controls>();
/** Test-only internal experiment evidence; never exported from a package barrel. */
export const getNativeOwnershipPublicExperiment = (
  tree: object
): Controls | undefined => controls.get(tree);

export function installNativeOwnershipPublicExperiment<T>(
  tree: ISignalTree<T>,
  config?: TransactionsConfig
): ISignalTree<T> & TransactionMethods {
  const root = tree.$ as object;
  const driver = nativeOwnershipExperiment(root);
  const scalar = getTreeScalarSlotRuntime(root);
  const registry = getPositionRegistry(root);
  if (!scalar || !registry)
    throw new Error(
      'Native ownership requires the existing causal scalar runtime'
    );
  const token = {};
  let destroyed = false;
  let sequence = 0;
  let observer: TransactionLifecycleObserver | undefined;
  let inspectionFailure: { error: unknown } | undefined;
  const pending = new Map<number, PendingTransactionFacts>();
  const confirmed: number[] = [];
  const retained = config?.history?.retain ?? 0;
  installTransactionLifecycleChannel(tree);
  const channel = getTransactionLifecycleChannel(tree);
  const record = (fact: TransactionLifecycleFact) => {
    sequence++;
    observer?.record(fact);
  };
  defineTransactionLifecycleSource(registry, {
    treeId: registry.id,
    read: () => ({ sequence, pending: [...pending.values()] }),
    attach(value) {
      observer = value;
    },
  });
  controls.set(tree, {
    authority: 'native-pending',
    failPreparation: (error, after) => driver.fail(error, after),
    failInspection(error) {
      inspectionFailure = { error };
    },
    stats: () => driver.stats(),
  });
  tree.registerCleanup(() => {
    destroyed = true;
    pending.clear();
    confirmed.length = 0;
    driver.destroy();
    cancelCommitScopes(token);
  });
  const transact = (fn: () => void): PendingTransaction => {
    if (destroyed) throw new Error('Cannot transact on a destroyed tree');
    if (typeof getActiveWriteContext()?.transactionId === 'number')
      throw new Error('Nested transaction is not supported');
    const notifier = getPathNotifier();
    notifier.flushSync();
    const raw = driver.open(),
      id = raw.id;
    let state: 'pending' | 'confirmed' | 'rejected' = 'pending';
    const isTerminal = () => state !== 'pending';
    let settling = false;
    let terminalEffects: (() => void) | undefined;
    let settlementAmbient = getActiveWriteContext();
    let frozen: TransactionInspection | undefined;
    let settlingSnapshot: TransactionInspection | undefined;
    const read = (): TransactionInspection => {
      if (inspectionFailure) throw inspectionFailure.error;
      return {
        changes: raw.details().map((change) => {
          const prefix =
            change.position === undefined
              ? undefined
              : registry.addressFor(change.position);
          // Public entity addresses describe the field; lifetime identity is separate.
          // Business keys are not address segments in the established inspection contract.
          const suffix = 'field' in change ? change.field : undefined;
          const address =
            prefix === undefined
              ? undefined
              : [
                  ...prefix,
                  ...(typeof suffix === 'string'
                    ? [suffix]
                    : suffix?.map(String) ?? []),
                ];
          return {
            path: address?.join('.') ?? '',
            address: address && [...address],
            subject: 'subject' in change ? change.subject : undefined,
            status: change.status,
          };
        }),
      };
    };
    const settle = (accepted: boolean) => {
      if (destroyed) throw new Error('Cannot settle a destroyed tree');
      if (settling)
        throw new Error('Transaction settlement is already in progress');
      if (state !== 'pending') {
        if ((state === 'confirmed') === accepted) {
          notifier.flushSync();
          driver.maintain();
          return;
        }
        throw new Error(
          accepted
            ? 'Cannot confirm a rolled back transaction'
            : 'Cannot rollback a confirmed transaction'
        );
      }
      let snapshot: TransactionInspection | undefined;
      try {
        snapshot = read();
      } catch {
        /* inspection availability cannot gate settlement */
      }
      settlingSnapshot = snapshot;
      settlementAmbient = getActiveWriteContext();
      const release = observer?.hold();
      settling = true;
      let failed = false;
      let failure: unknown;
      let deliveryFailed = false;
      let deliveryFailure: unknown;
      const remember = (error: unknown) => {
        if (!failed) {
          failed = true;
          failure = error;
        }
      };
      try {
        // Keep realization provenance, but close native delivery after its
        // context exits so observers may author a new public transaction.
        scalar.runInvalidationGroup(() =>
          withWriteContext(
            {
              ...settlementAmbient,
              transactionId: id,
              transactionOwner: token,
            },
            () => (accepted ? raw.confirm() : raw.rollback())
          )
        );
      } catch (cause) {
        if (raw.pending()) {
          const error =
            cause instanceof SignalTreeRollbackError
              ? cause
              : new SignalTreeRollbackError(undefined, { cause });
          record({ kind: 'refused', transactionId: id, error });
          remember(error);
        } else {
          deliveryFailed = true;
          deliveryFailure = cause;
        }
      } finally {
        // Native projection invalidation has completed at the outer group
        // boundary. Terminal consequences must read that installed truth.
        const finish = terminalEffects;
        terminalEffects = undefined;
        try {
          finish?.();
        } catch (error) {
          remember(error);
        }
        // As in the incumbent, terminal cleanup failures take precedence over
        // deferred observer failures; both phases are still attempted.
        if (deliveryFailed) remember(deliveryFailure);
        settling = false;
        if (isTerminal()) frozen = snapshot;
        try {
          release?.();
        } catch (error) {
          remember(error);
        }
      }
      if (isTerminal() && !destroyed) {
        // Reclamation follows diagnostic/history capture and delivery. A
        // failed maintenance attempt stays queued and same-terminal retry
        // can finish it without manufacturing pending transaction authority.
        try {
          notifier.flushSync();
          driver.maintain();
        } catch (error) {
          remember(error);
        }
      }
      if (failed) throw failure;
    };
    const handle: PendingTransaction = {
      inspect: () => frozen ?? read(),
      confirm: () => settle(true),
      rollback: () => settle(false),
    };
    raw.onInstalled((accepted) =>
      withWriteContext(settlementAmbient ?? {}, () => {
        state = accepted ? 'confirmed' : 'rejected';
        frozen = settlingSnapshot;
        pending.delete(id);
        if (accepted && retained > 0) {
          confirmed.push(id);
          if (confirmed.length > retained) confirmed.shift();
        }
        record({
          kind: accepted ? 'confirmed' : 'rolled-back',
          transactionId: id,
        });
        terminalEffects = () =>
          withWriteContext(settlementAmbient ?? {}, () => {
            try {
              channel.announce({
                kind: accepted ? 'confirmed' : 'rolled-back',
                owner: token,
                id,
              });
            } finally {
              settleCommitScope(token, id, accepted ? 'commit' : 'discard');
            }
          });
      })
    );
    pending.set(id, {
      transactionId: id,
      phase: 'opened',
      consequencesReleased: false,
    });
    const openedRelease = observer?.hold();
    try {
      record({ kind: 'opened', transactionId: id });
      channel.announce({ kind: 'opened', owner: token, id });
    } finally {
      openedRelease?.();
    }
    if (destroyed) throw new Error('Cannot transact on a destroyed tree');
    notifier.flushSync();
    if (destroyed) throw new Error('Cannot transact on a destroyed tree');
    openCommitScope(token, id, tree as object);
    let primaryFailed = false,
      primary: unknown,
      cleanupFailed = false,
      cleanup: unknown;
    try {
      scalar.runInvalidationGroup(() =>
        raw.run(() => {
          try {
            withWriteContext(
              {
                ...getActiveWriteContext(),
                transactionId: id,
                transactionOwner: token,
              },
              fn
            );
          } catch (error) {
            primaryFailed = true;
            primary = error;
          }
        })
      );
    } catch (error) {
      cleanupFailed = true;
      cleanup = error;
    }
    if (!destroyed && !primaryFailed && !cleanupFailed) {
      pending.set(id, {
        transactionId: id,
        phase: 'staged',
        consequencesReleased: false,
      });
      const stagedRelease = observer?.hold();
      try {
        record({ kind: 'staged', transactionId: id });
        channel.announce({ kind: 'staged', owner: token, id });
      } finally {
        stagedRelease?.();
      }
    }
    try {
      notifier.flushSync();
      if (!destroyed) driver.maintain();
    } catch (error) {
      if (!primaryFailed && !cleanupFailed) {
        cleanupFailed = true;
        cleanup = error;
      }
    }
    if (primaryFailed || cleanupFailed) {
      try {
        handle.rollback();
      } catch (error) {
        if (isTerminal()) {
          try {
            console.error(
              'SignalTree: public native rollback delivery after callback failure.',
              error
            );
          } catch {
            /* preserve primary */
          }
          throw primaryFailed ? primary : cleanup;
        }
        if (!primaryFailed) {
          try {
            console.error(
              'SignalTree: transactions() cleanup failed during a post-callback step whose rollback was then refused.',
              cleanup
            );
          } catch {
            /* reporting cannot replace the first failure */
          }
        }
        if (!destroyed && error instanceof SignalTreeRollbackError)
          Object.defineProperty(error, 'recovery', {
            value: {
              transaction: handle,
              callbackFailed: primaryFailed,
              callbackError: primary,
            },
            configurable: true,
          });
        throw error;
      }
      throw primaryFailed ? primary : cleanup;
    }
    return handle;
  };
  const host = tree as ISignalTree<T> & TransactionMethods;
  host.transact = transact;
  (tree as unknown as Record<string, unknown>)['__transactions'] = {
    getPendingTurnCount: () => pending.size,
    getPendingTurnIds: () => [...pending.keys()],
    getConfirmedTurnCount: () => confirmed.length,
    getConfirmedTurnIds: () => [...confirmed],
  };
  return host;
}
