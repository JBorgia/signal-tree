import { describe, expect, it, vi } from 'vitest';

import { observeWrites } from '../../internals';
import {
  restorationReader,
  type RestorationReaderEvent,
  type RestorationReaderSnapshot,
} from '../../lib/internals/restoration-reader';
import { getTreeRealizationDescriptors } from '../../lib/internals/causal-runtime/tree-realization-adapter';
import { getSubjectRestorationClaims } from '../../lib/internals/subject-restoration-claims';
import { transactionLifecycleReader } from '../../lib/internals/transaction-lifecycle-view';
import { entityMap } from '../../lib/markers/entity-map';
import { signalTree } from '../../lib/signal-tree';
import { undoable } from '../../lib/undoable';
import { withWriteContext } from '../../lib/write-context';
import { transactions } from '../transactions/transactions';
import { restoration } from './restoration';

type Row = { id: number; value: number };
const flush = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};
const ORDERS = [
  ['transactions first', () => [transactions(), restoration()]],
  ['restoration first', () => [restoration(), transactions()]],
] as const;

function expectEmptyManagerHistory(tree: unknown): void {
  const manager = (
    tree as {
      __restoration: {
        history: unknown[];
        pendingTurns: ReadonlyMap<number, unknown>;
      };
    }
  ).__restoration;
  expect(manager.history).toEqual([]);
  expect(manager.pendingTurns.size).toBe(0);
}

// This counts one concrete copying mechanism, not every allocation. Fixtures
// and observations are constructed outside the counter. The designated control
// must exercise the same hook, so demand gating cannot make the proof vacuous.
async function countEffectCopies(write: () => void): Promise<number> {
  let copies = 0;
  const originalMap = Array.prototype.map;
  const spy = vi
    .spyOn(Array.prototype, 'map')
    .mockImplementation(function (this: unknown[], callback, thisArg) {
      if (callback.name === 'cloneTurnEffect') copies += this.length;
      return originalMap.call(this, callback, thisArg);
    });
  try {
    write();
    await flush();
  } finally {
    spy.mockRestore();
  }
  return copies;
}

describe('ordinary restoration capture materialization', () => {
  it('discards descriptor inputs when restoration is the only enhancer', async () => {
    const rows = [
      { id: 1, value: 1 },
      { id: 2, value: 2 },
    ];
    const tree = signalTree(
      { count: 0, rows: entityMap<Row, number>({ selectId: (row) => row.id }) },
      { enhancers: [restoration()] }
    );
    try {
      tree.$.rows.setAll(rows);
      await flush();
      tree.$.rows.setAll([rows[1], rows[0]]);
      await flush();
      expect(getTreeRealizationDescriptors(tree)?.size ?? 0).toBe(0);
      undoable(() => tree.$.count(1));
      await flush();
      expect(
        [...(getTreeRealizationDescriptors(tree)?.values() ?? [])].map(
          (descriptor) => descriptor.path
        )
      ).toEqual(['count']);
      tree.undo();
      expect(tree.$.count()).toBe(0);
      expect(tree.$.rows.all()).toEqual([rows[1], rows[0]]);
    } finally {
      tree.destroy();
    }
  });

  it.each([
    ['restoration only', () => [restoration()], 0],
    [ORDERS[0][0], ORDERS[0][1], 32],
    [ORDERS[1][0], ORDERS[1][1], 32],
  ] as const)(
    'skips discarded restoration effect copies (%s)',
    async (_order, enhancers, expectedCopies) => {
      const rows = Array.from({ length: 32 }, (_, id) => ({ id, value: id }));
      const tree = signalTree(
        { rows: entityMap<Row, number>({ selectId: (row) => row.id }) },
        { enhancers: enhancers() }
      );
      const reader = restorationReader(tree)!;
      const initial = reader.snapshot();
      const events: RestorationReaderEvent[] = [];
      const offReader = reader.subscribe((event) => events.push(event));
      let observedWrites = 0;
      const offWrites = observeWrites((frame) => {
        if (frame.ownerId === initial.treeId) observedWrites++;
      });
      try {
        await flush();
        const copies = await countEffectCopies(() => tree.$.rows.setAll(rows));
        expect(tree.$.rows.all()).toEqual(rows);
        expect(observedWrites).toBeGreaterThan(0);
        expect(tree.getRestorationHistory()).toEqual([]);
        expect(reader.snapshot()).toEqual(initial);
        expect(events).toEqual([]);

        const control = await countEffectCopies(() =>
          undoable(() => tree.$.rows.updateOne(0, { value: 99 }))
        );
        expect(
          control,
          'designated control must exercise the counter'
        ).toBeGreaterThan(0);
        expect(reader.snapshot().entries).toHaveLength(1);
        tree.undo();
        expect(tree.$.rows.all()).toEqual(rows);
        tree.redo();
        expect(tree.$.rows.byIdOrFail(0).value()).toBe(99);
        expect(copies, 'ordinary cloneTurnEffect input count').toBe(
          expectedCopies
        );
      } finally {
        offWrites();
        offReader();
        tree.destroy();
      }
    }
  );
});

describe.each(ORDERS)(
  'ordinary restoration boundaries (%s)',
  (_order, enhancers) => {
    it('promotes earlier ordinary writes when a later same-turn write is designated', async () => {
      const tree = signalTree({ x: 0, y: 0 }, { enhancers: enhancers() });
      try {
        tree.$.x(1);
        undoable(() => tree.$.y(2));
        await flush();
        expect(tree.getRestorationHistory().map(({ state }) => state)).toEqual([
          { x: 1, y: 2 },
        ]);
        tree.undo();
        expect(tree.$()).toEqual({ x: 0, y: 0 });
        tree.redo();
        expect(tree.$()).toEqual({ x: 1, y: 2 });
      } finally {
        tree.destroy();
      }
    });

    it('clears ordinary effects, orders and descriptor inputs before the next designated turn', async () => {
      const rows = [
        { id: 1, value: 1 },
        { id: 2, value: 2 },
      ];
      const reversed = [rows[1], rows[0]];
      const tree = signalTree(
        {
          count: 0,
          rows: entityMap<Row, number>({ selectId: (row) => row.id }),
        },
        { enhancers: enhancers() }
      );
      try {
        tree.$.rows.setAll(rows);
        await flush();
        tree.$.rows.setAll(reversed);
        await flush();
        // Transactions may retain a descriptor shell after an ordinary reorder.
        // Its subject representation must still be empty after scalar admission.
        undoable(() => tree.$.count(1));
        await flush();
        expect(
          getSubjectRestorationClaims(tree)?.snapshot() ?? {
            owners: 0,
            claimedSubjects: 0,
          }
        ).toEqual({
          owners: 0,
          claimedSubjects: 0,
        });
        for (const descriptor of getTreeRealizationDescriptors(
          tree
        )?.values() ?? []) {
          expect(descriptor.subjectDescriptors?.size ?? 0).toBe(0);
          expect(descriptor.structuralEffects?.size ?? 0).toBe(0);
          expect(descriptor.structuralEffectBySubject?.size ?? 0).toBe(0);
        }
        tree.undo();
        expect(tree.$.count()).toBe(0);
        expect(tree.$.rows.all()).toEqual(reversed);
        tree.redo();
        expect(tree.$.count()).toBe(1);
        expect(tree.$.rows.all()).toEqual(reversed);
      } finally {
        tree.destroy();
      }
    });

    it.each(['ordinary', 'realized', 'redo-only'] as const)(
      'keeps historical gaps for retained history (%s)',
      async (mode) => {
        const tree = signalTree({ x: 0, y: 0 }, { enhancers: enhancers() });
        try {
          undoable(() => tree.$.x(1));
          await flush();
          if (mode === 'redo-only') {
            tree.undo();
            await flush();
            expect(tree.canUndo()).toBe(false);
            expect(tree.canRedo()).toBe(true);
          }
          if (mode === 'realized') {
            withWriteContext({ participation: 'realized' }, () => tree.$.y(1));
          } else {
            tree.$.y(1);
          }
          await flush();
          expect(
            tree.getRestorationHistory().map(({ state }) => state)
          ).toEqual([{ x: 1, y: 0 }]);
          if (mode === 'redo-only') tree.redo();
          expect(tree.$()).toEqual({ x: 1, y: 1 });
        } finally {
          tree.destroy();
        }
      }
    );

    it('keeps an ordinary gap while only a designated manager pending turn exists', async () => {
      const tree = signalTree({ x: 0, y: 0 }, { enhancers: enhancers() });
      const reader = restorationReader(tree)!;
      const initial = reader.snapshot();
      const deliveries: Array<{
        event: RestorationReaderEvent;
        snapshot: RestorationReaderSnapshot;
      }> = [];
      const off = reader.subscribe((event, snapshot) =>
        deliveries.push({ event, snapshot })
      );
      try {
        tree.$.y(-1);
        await flush();
        tree.$.y(0);
        await flush();
        expect(reader.snapshot()).toEqual(initial);
        expect(deliveries).toEqual([]);
        const pending = tree.transaction(() => undoable(() => tree.$.x(1)));
        expect(tree.getRestorationHistory()).toEqual([]);
        expect(reader.snapshot()).toEqual({ ...initial, sequence: 1 });
        tree.$.y(1);
        await flush();
        expect(reader.snapshot()).toEqual({ ...initial, sequence: 1 });
        pending.confirm();
        expect(tree.$()).toEqual({ x: 1, y: 1 });
        expect(tree.getRestorationHistory().map(({ state }) => state)).toEqual([
          { x: 1, y: 0 },
        ]);
        const confirmed = reader.snapshot();
        expect(confirmed).toMatchObject({
          sequence: 2,
          currentIndex: 0,
          canUndo: true,
          canRedo: false,
          entries: [
            {
              entryId: 'restoration-entry:1',
              transactionIds: [1],
              status: 'applied',
            },
          ],
        });
        expect(deliveries).toEqual([
          {
            event: {
              kind: 'history-changed',
              treeId: initial.treeId,
              sequence: 1,
            },
            snapshot: { ...initial, sequence: 1 },
          },
          {
            event: {
              kind: 'history-changed',
              treeId: initial.treeId,
              sequence: 2,
            },
            snapshot: confirmed,
          },
        ]);
        tree.undo();
        expect(tree.$()).toEqual({ x: 0, y: 1 });
      } finally {
        off();
        tree.destroy();
      }
    });

    it('preserves the later undo step designated by a write delivery observer', async () => {
      const tree = signalTree({ x: 0, y: 0 }, { enhancers: enhancers() });
      const reader = restorationReader(tree)!;
      const initial = reader.snapshot();
      const seen: RestorationReaderSnapshot[] = [];
      let reentered = false;
      const off = observeWrites((frame) => {
        if (
          frame.ownerId !== initial.treeId ||
          frame.path !== 'x' ||
          frame.after !== 1 ||
          reentered
        ) {
          return;
        }
        reentered = true;
        seen.push(reader.snapshot());
        undoable(() => tree.$.y(2));
      });
      try {
        tree.$.x(1);
        await flush();
        expect(reentered).toBe(true);
        expect(seen).toEqual([initial]);
        expect(reader.snapshot()).toMatchObject({
          sequence: 1,
          entries: [{ transactionIds: [], status: 'applied' }],
        });
        // Baseline delivery puts this observer's write in the later turn;
        // synchronous writes before delivery are covered by the promotion case.
        tree.undo();
        expect(tree.$()).toEqual({ x: 1, y: 0 });
        tree.redo();
        expect(tree.$()).toEqual({ x: 1, y: 2 });
      } finally {
        off();
        tree.destroy();
      }
    });

    it('keeps a gap written reentrantly by the first history reader notification', async () => {
      const tree = signalTree({ x: 0, y: 0 }, { enhancers: enhancers() });
      const reader = restorationReader(tree)!;
      const seen: RestorationReaderSnapshot[] = [];
      let reentered = false;
      const off = reader.subscribe((event, snapshot) => {
        if (event.kind !== 'history-changed' || reentered) return;
        reentered = true;
        seen.push(snapshot);
        tree.$.y(2);
      });
      try {
        undoable(() => tree.$.x(1));
        await flush();
        expect(reentered).toBe(true);
        expect(seen).toHaveLength(1);
        expect(seen[0]).toMatchObject({
          sequence: 1,
          entries: [
            {
              entryId: 'restoration-entry:1',
              transactionIds: [],
              status: 'applied',
            },
          ],
        });
        expect(reader.snapshot()).toEqual(seen[0]);
        expect(tree.$()).toEqual({ x: 1, y: 2 });
        expect(tree.getRestorationHistory().map(({ state }) => state)).toEqual([
          { x: 1, y: 0 },
        ]);
        tree.undo();
        expect(tree.$()).toEqual({ x: 0, y: 2 });
      } finally {
        off();
        tree.destroy();
      }
    });

    it.each(['confirm', 'rollback'] as const)(
      'settles an undesignated pending transaction after an empty-manager ordinary flush (%s)',
      async (settle) => {
        const tree = signalTree({ x: 0, y: 0 }, { enhancers: enhancers() });
        const reader = restorationReader(tree)!;
        const lifecycle = transactionLifecycleReader(tree)!;
        const initial = reader.snapshot();
        try {
          const pending = tree.transaction(() => tree.$.x(1));
          expectEmptyManagerHistory(tree);
          const staged = lifecycle.snapshot();
          expect(staged.pending).toEqual([
            { transactionId: 1, phase: 'staged', consequencesReleased: false },
          ]);
          tree.$.y(2);
          await flush();
          expectEmptyManagerHistory(tree);
          expect(reader.snapshot()).toEqual(initial);
          expect(lifecycle.snapshot()).toEqual(staged);
          expect(tree.$()).toEqual({ x: 1, y: 2 });
          pending[settle]();
          await flush();
          expect(tree.$()).toEqual({ x: settle === 'confirm' ? 1 : 0, y: 2 });
          expect(lifecycle.snapshot()).toEqual({
            ...staged,
            sequence: staged.sequence + 1,
            pending: [],
          });
          expectEmptyManagerHistory(tree);
          expect(reader.snapshot()).toEqual(initial);
        } finally {
          tree.destroy();
        }
      }
    );

    it('preserves undesignated pending footprints across an empty-manager ordinary flush', async () => {
      const tree = signalTree({ x: 0, y: 0 }, { enhancers: enhancers() });
      try {
        const pending = tree.transaction(() => tree.$.x(1));
        expectEmptyManagerHistory(tree);
        tree.$.y(1);
        await flush();
        expectEmptyManagerHistory(tree);
        // Later history must still see the older pending location's footprint.
        undoable(() => tree.$.x(2));
        await flush();
        expect(() => tree.undo()).toThrow(/ST1034/);
        expect(tree.$()).toEqual({ x: 2, y: 1 });
        pending.confirm();
        tree.undo();
        expect(tree.$()).toEqual({ x: 1, y: 1 });
      } finally {
        tree.destroy();
      }
    });
  }
);
