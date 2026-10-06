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
// `.transact(`. Slice 6 moved the opaque `leaf()` undo/redo block out (class
// c): v16 refused it ("Unsupported scoped undo effect at structural-drift")
// until atomic registered-terminal reversal (integration slice 8, donor v15
// 2892b650). Slice 8 restores that block here unchanged; the preserved copy in
// docs/audits/2026-10-01-v16-integration/preserved/
// vue-tooling-admission-leaf-undo.spec.ts.txt stays as the historical record.
// v16 controls kept from slice 6: the native leaf location and the restoration
// reader's entry status across the undo/redo.
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
          .turns[0].effects.find((effect) => effect.path === 'count');
        expect(scalar).toBeDefined();
        expect(
          locations.locate([{ position: scalar?.position ?? -1 }])
        ).toEqual([[{ kind: 'property', key: 'count' }]]);
        expect(links.snapshot()).toMatchObject({ treeId: id, links: [] });

        undoable(() => {
          tree.$.bounds.value = { min: 1, max: 9 };
        });
        await flush();
        expect(history.snapshot().treeId).toBe(id);
        expect(history.snapshot().entries).toHaveLength(1);
        expect(tree.$.bounds.value).toEqual({ min: 1, max: 9 });
        const [entry] = history.snapshot().entries;
        tree.undo();
        await flush();
        expect(tree.$.bounds.value).toEqual({ min: 0, max: 10 });
        expect(history.snapshot().entries[0]).toMatchObject({
          entryId: entry.entryId,
          status: 'unapplied',
        });
        tree.redo();
        await flush();
        expect(tree.$.bounds.value).toEqual({ min: 1, max: 9 });
        expect(history.snapshot().entries[0].status).toBe('applied');
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
