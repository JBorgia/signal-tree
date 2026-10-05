import { describe, expect, it } from 'vitest';
import { isRef } from 'vue';

import {
  entityMap,
  leaf,
  restoration,
  signalTree,
  transactions,
  undoable,
} from '../index';
import {
  confirmedTurnReader,
  entityMembershipReader,
  linkStateReader,
  restorationReader,
  stateLocationReader,
  transactionLifecycleReader,
  treeCapabilities,
  treeRuntimeId,
} from '@signal-tree/kernel/internals';

// Carried from v15 012fd11d (v16 integration slice 6): `.transaction(` ->
// `.transact(`. One part is moved, not weakened (class c): undo/redo of the
// opaque `leaf()` replacement is refused on v16 before this slice
// ("Unsupported scoped undo effect at structural-drift"; atomic
// registered-terminal reversal is integration slice 8; on 515a6969 even a
// later scalar undo is refused once an external leaf write sits in the
// history gap). The donor block is preserved in
// docs/audits/2026-10-01-v16-integration/preserved/
// vue-tooling-admission-leaf-undo.spec.ts.txt. Here the restoration reader is
// exercised with undo/redo of a scalar entry, and the leaf is still written
// through its native carrier afterwards.
const flush = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};

describe('tooling admits public Vue trees directly', () => {
  it.each([false, true])(
    'reads native carriers and enforces destruction (restoration first=%s)',
    async (first) => {
      const tree = signalTree(
        {
          count: 0,
          bounds: leaf({ min: 0, max: 10 }),
          rows: entityMap<{ id: number; name: string }, number>(),
        },
        {
          enhancers: first
            ? [restoration(), transactions({ history: { retain: 2 } })]
            : [transactions({ history: { retain: 2 } }), restoration()],
        }
      );
      try {
        expect(isRef(tree.destroyed)).toBe(true);
        expect(typeof tree.destroyed).toBe('function');
        expect(tree.destroyed.value).toBe(false);
        expect(treeCapabilities(tree)).toBeDefined();
        const id = treeRuntimeId(tree);
        expect(id).toBeDefined();

        const confirmed = confirmedTurnReader(tree);
        const lifecycle = transactionLifecycleReader(tree);
        const history = restorationReader(tree);
        const membership = entityMembershipReader(tree);
        const locations = stateLocationReader(tree);
        const links = linkStateReader(tree);
        if (!confirmed || !lifecycle || !history || !membership || !locations) {
          throw new Error('Expected all configured tooling readers');
        }

        const pending = tree.transact(() => {
          tree.$.count.value = 1;
          tree.$.rows.addOne({ id: 1, name: 'Ada' });
        });
        expect(lifecycle.snapshot().pending).toHaveLength(1);
        pending.confirm();
        await flush();
        expect(confirmed.readConfirmedTurns().turns).toHaveLength(1);
        expect(confirmed.treeId).toBe(id);
        expect(lifecycle.snapshot()).toMatchObject({
          treeId: id,
          sequence: 3,
          pending: [],
        });
        const collection = membership.snapshot().collections[0];
        expect(collection.members.map((member) => member.key)).toEqual([1]);
        expect(membership.snapshot().treeId).toBe(id);
        expect(
          locations.locate([{ position: collection.collectionPosition }])
        ).toEqual([[{ kind: 'property', key: 'rows' }]]);
        // v16 control (slice 6): a native Vue leaf's position resolves too.
        const scalar = confirmed
          .readConfirmedTurns()
          .turns[0].effects.find((effect) => effect.path === 'count')!;
        expect(locations.locate([{ position: scalar.position }])).toEqual([
          [{ kind: 'property', key: 'count' }],
        ]);
        expect(links.snapshot()).toMatchObject({ treeId: id, links: [] });

        undoable(() => {
          tree.$.count.value = 2;
        });
        await flush();
        expect(history.snapshot().treeId).toBe(id);
        expect(history.snapshot().entries).toHaveLength(1);
        const [entry] = history.snapshot().entries;
        tree.undo();
        await flush();
        expect(tree.$.count.value).toBe(1);
        expect(history.snapshot().entries[0]).toMatchObject({
          entryId: entry.entryId,
          status: 'unapplied',
        });
        tree.redo();
        await flush();
        expect(tree.$.count.value).toBe(2);
        expect(history.snapshot().entries[0].status).toBe('applied');
        tree.$.bounds.value = { min: 1, max: 9 };
        expect(tree.$.bounds.value).toEqual({ min: 1, max: 9 });
        tree.destroy();
        expect(tree.destroyed.value).toBe(true);
        for (const read of [
          () => confirmed.readConfirmedTurns(),
          () => lifecycle.snapshot(),
          () => history.snapshot(),
          () => membership.snapshot(),
          () => locations.locate([]),
          () => links.snapshot(),
        ]) {
          expect(read).toThrow(/destroyed/i);
        }
      } finally {
        tree.destroy();
      }
    }
  );
});
