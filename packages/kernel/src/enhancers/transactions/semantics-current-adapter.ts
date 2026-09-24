/** Test-only current-source translation. No candidate semantics are implemented here. */
import { observeOwnerInvalidation } from '../../adapter';
import { signalTree } from '../../lib/signal-tree';
import { entityMap } from '../../lib/markers/entity-map';
import { SignalTreeRollbackError, type WritableLeaf } from '../../lib/types';
import { withWriteContext } from '../../lib/write-context';
import { peekInternalTransactionRuntime, transactions } from './transactions';
import {
  UnsupportedSemantic,
  type Handle,
  type SemanticCandidate,
  type SettlementResult,
  type Snapshot,
} from './semantics-contract';

const flushTwice = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

type Pending = { confirm(): void; rollback(): void };

type AdapterTree = {
  $: {
    x: WritableLeaf<number>;
    y: WritableLeaf<number>;
    z: WritableLeaf<number>;
  };
  transact(fn: () => void): Pending;
  destroy(): void;
  destroyed(): boolean;
};

export function adaptCurrent(
  tree: AdapterTree,
  runtime: ReturnType<typeof peekInternalTransactionRuntime>,
  extraSnapshot: () => Snapshot = () => ({}),
  observationOwner: Parameters<typeof observeOwnerInvalidation>[0] = tree
) {
  if (!runtime) {
    tree.destroy();
    throw new Error('transactions enhancer did not install its runtime');
  }
  const write = (key: string, value: unknown) => {
    if (
      (key !== 'x' && key !== 'y' && key !== 'z') ||
      typeof value !== 'number'
    ) {
      throw new Error(`Invalid scalar fixture write: ${key}=${String(value)}`);
    }
    tree.$[key](value);
  };
  const read = (): Snapshot => ({
    x: tree.$.x(),
    y: tree.$.y(),
    z: tree.$.z(),
    ...extraSnapshot(),
  });
  const handles = new Map<Handle, { pending: Pending; pendingId?: number }>();
  const entryFor = (handle: Handle) => {
    const entry = handles.get(handle);
    if (!entry) throw new Error('Unknown fixture handle');
    return entry;
  };
  const subscriptions = new Set<() => void>();
  const candidate: SemanticCandidate = {
    beginContribution(fn) {
      const before = new Set(runtime.getPendingTurnIds());
      const pending = tree.transact(fn);
      const added = runtime.getPendingTurnIds().filter((id) => !before.has(id));
      // These scalar cases open one synchronous contribution. Associate only
      // an unambiguous actual pending ID, never the ambient transaction ID
      // (which belongs to a different sequence) or tree-wide pending presence.
      const h: Handle = { __brand: 'contribution' };
      handles.set(h, {
        pending,
        pendingId: added.length === 1 ? added[0] : undefined,
      });
      return h;
    },
    settleAccept(handle): SettlementResult {
      const { pending } = entryFor(handle);
      try {
        pending.confirm();
        return { status: 'settled' };
      } catch (reason) {
        if (
          !(reason instanceof SignalTreeRollbackError) &&
          !(
            reason instanceof Error &&
            /^Cannot (confirm a rolled back|rollback a confirmed) transaction$/.test(
              reason.message
            )
          )
        )
          throw reason;
        return { status: 'refused', reason };
      }
    },
    settleReject(handle): SettlementResult {
      const { pending } = entryFor(handle);
      try {
        pending.rollback();
        return { status: 'settled' };
      } catch (reason) {
        if (
          !(reason instanceof SignalTreeRollbackError) &&
          !(
            reason instanceof Error &&
            /^Cannot (confirm a rolled back|rollback a confirmed) transaction$/.test(
              reason.message
            )
          )
        )
          throw reason;
        return { status: 'refused', reason };
      }
    },
    applyAuthority(event) {
      const relations =
        event.settlement === undefined
          ? []
          : Array.isArray(event.settlement)
          ? event.settlement
          : [event.settlement];
      if (relations.some((relation) => relation.kind !== 'none')) {
        throw new UnsupportedSemantic(
          'Current implementation has no correlated authority settlement input'
        );
      }
      if (event.order.kind === 'versioned') {
        throw new UnsupportedSemantic(
          'Current implementation has no revision-ordering input'
        );
      }
      if (event.truth) {
        withWriteContext(
          { intent: 'system', participation: 'realized' },
          event.truth
        );
      }
    },
    readCanonical() {
      throw new UnsupportedSemantic(
        'Current implementation exposes no canonical/pending split'
      );
    },
    readVisible: read,
    readSettlementState(handle) {
      const { pendingId } = entryFor(handle);
      if (pendingId === undefined) {
        throw new UnsupportedSemantic(
          'No unambiguous pending ID for this handle'
        );
      }
      if (runtime.getPendingTurnIds().includes(pendingId)) {
        return { disposition: 'pending', retainsAuthority: true };
      }
      throw new UnsupportedSemantic(
        'Pending ID is absent; no native terminal disposition reader for this handle'
      );
    },
    observeVisible(callback) {
      const nativeOff = observeOwnerInvalidation(observationOwner, () =>
        callback(read())
      );
      const off = () => {
        nativeOff();
        subscriptions.delete(off);
      };
      subscriptions.add(off);
      return off;
    },
  };
  return {
    candidate,
    write,
    flush: flushTwice,
    // Instrumented native membership, NOT a terminal disposition inference.
    hasPendingAuthority(handle: Handle): boolean {
      const id = entryFor(handle).pendingId;
      if (id === undefined)
        throw new UnsupportedSemantic('No unambiguous native pending ID');
      return runtime.getPendingTurnIds().includes(id);
    },
    confirmedCount: () => runtime.getConfirmedTurnCount(),
    dispose() {
      for (const off of subscriptions) off();
      tree.destroy();
    },
  };
}

export const makeCurrent = async () => {
  const tree = signalTree(
    { x: 0, y: 0, z: 0 },
    { enhancers: [transactions()] }
  );
  // Read using the actual inferred tree type, including cleanup/update methods.
  return adaptCurrent(tree, peekInternalTransactionRuntime(tree));
};

// Supplemental fixture only: public operations establish an occupied destination.
// No private planner injection and no adapter-generated refusal.
export const makeOccupiedConflict = async () => {
  const tree = signalTree(
    {
      x: 0,
      y: 0,
      z: 0,
      rows: entityMap<{ id: string; value: number }, string>(),
    },
    { enhancers: [transactions()] }
  );
  const fixture = adaptCurrent(
    tree,
    peekInternalTransactionRuntime(tree),
    () => ({ rows: tree.$.rows.all() })
  );
  const realize = (fn: () => void) =>
    withWriteContext({ intent: 'system', participation: 'realized' }, fn);
  return {
    ...fixture,
    async prepareConflict() {
      realize(() => tree.$.rows.addOne({ id: 'A', value: 0 }));
      await fixture.flush();
      const handle = fixture.candidate.beginContribution(() => {
        tree.$.x(1);
        tree.$.rows.removeOne('A');
      });
      await fixture.flush();
      realize(() => tree.$.rows.addOne({ id: 'A', value: 2 }));
      await fixture.flush();
      return handle;
    },
    async resolveConflict() {
      realize(() => tree.$.rows.removeOne('A'));
      await fixture.flush();
    },
  };
};
