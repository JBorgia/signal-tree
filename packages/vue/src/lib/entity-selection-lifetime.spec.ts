import { describe, expect, it } from 'vitest';
import { nextTick, watch, watchEffect } from 'vue';

import { entityMap, signalTree, transactions } from '../index';

type Row = { id: string; v: number };
const build = () =>
  signalTree(
    { rows: entityMap<Row, string>({ selectId: (row) => row.id }) },
    { enhancers: [transactions()] }
  );
type Tree = ReturnType<typeof build>;
const observe = (tree: Tree) => {
  let stage = 'setup';
  const frames: {
    stage: string;
    activeId: string | undefined;
    direct: number | undefined;
    active: number | undefined;
  }[] = [];
  const sample = () => {
    const activeId = tree.$.rows.activeId.value;
    return {
      stage,
      activeId,
      direct:
        activeId === undefined ? undefined : tree.$.rows.byId(activeId)?.()?.v,
      active: tree.$.rows.activeEntity.value?.v,
    };
  };
  const dispose = watchEffect(
    () => {
      frames.push(sample());
    },
    { flush: 'sync' }
  );
  return {
    frames,
    dispose,
    stage(value: string) {
      stage = value;
    },
    check(activeId: string | undefined, value: number | undefined) {
      expect(sample(), JSON.stringify(frames)).toEqual({
        stage,
        activeId,
        direct: value,
        active: value,
      });
    },
  };
};

describe('Vue entity selection lifetime', () => {
  it('resolves initially absent selection when its row is inserted', async () => {
    const tree = build();
    tree.$.rows.setActiveId('A');
    const observation = observe(tree);
    try {
      observation.check('A', undefined);
      observation.stage('insert');
      tree.$.rows.addOne({ id: 'A', v: 1 });
      await nextTick();
      observation.check('A', 1);
      expect(
        observation.frames.some(
          (frame) => frame.stage === 'insert' && frame.active === 1
        )
      ).toBe(true);
    } finally {
      observation.dispose();
      tree.destroy();
    }
  });

  it('resolves restored membership to the same held lifetime after rollback', async () => {
    const tree = build();
    tree.$.rows.addOne({ id: 'A', v: 1 });
    tree.$.rows.setActiveId('A');
    const held = tree.$.rows.byIdOrFail('A');
    const observation = observe(tree);
    try {
      observation.check('A', 1);
      observation.stage('remove');
      const pending = tree.transact(() => tree.$.rows.removeOne('A'));
      await nextTick();
      observation.check('A', undefined);
      observation.stage('rollback');
      pending.rollback();
      await nextTick();
      observation.check('A', 1);
      expect(tree.$.rows.byIdOrFail('A')).toBe(held);
      expect(held()?.v).toBe(1);
    } finally {
      observation.dispose();
      tree.destroy();
    }
  });

  it('retargets key-based selection but never a held row to a new lifetime at the same key', async () => {
    const tree = build();
    tree.$.rows.addOne({ id: 'A', v: 1 });
    tree.$.rows.setActiveId('A');
    const held = tree.$.rows.byIdOrFail('A');
    const observation = observe(tree);
    try {
      observation.check('A', 1);
      observation.stage('remove');
      tree.$.rows.removeOne('A');
      await nextTick();
      observation.check('A', undefined);
      observation.stage('new-lifetime');
      tree.$.rows.addOne({ id: 'A', v: 9 });
      await nextTick();
      observation.check('A', 9);
      expect(tree.$.rows.byIdOrFail('A')).not.toBe(held);
      expect(held()?.v).not.toBe(9);
    } finally {
      observation.dispose();
      tree.destroy();
    }
  });

  it('tracks selection changes while absent and ignores arrivals at the old selected key', async () => {
    const tree = build();
    tree.$.rows.setActiveId('A');
    const observation = observe(tree);
    try {
      observation.check('A', undefined);
      observation.stage('select-B');
      tree.$.rows.setActiveId('B');
      await nextTick();
      observation.check('B', undefined);
      observation.stage('insert-A');
      tree.$.rows.addOne({ id: 'A', v: 1 });
      await nextTick();
      observation.check('B', undefined);
      observation.stage('insert-B');
      tree.$.rows.addOne({ id: 'B', v: 2 });
      await nextTick();
      observation.check('B', 2);
      observation.stage('clear');
      tree.$.rows.clearActiveId();
      await nextTick();
      observation.check(undefined, undefined);
    } finally {
      observation.dispose();
      tree.destroy();
    }
  });

  it('moves selected key on rekey while retaining the selected lifetime', async () => {
    const tree = build();
    tree.$.rows.addOne({ id: 'A', v: 1 });
    tree.$.rows.setActiveId('A');
    const held = tree.$.rows.byIdOrFail('A');
    const observation = observe(tree);
    try {
      observation.check('A', 1);
      observation.stage('rekey');
      tree.$.rows.changeId('A', 'B');
      await nextTick();
      observation.check('B', 1);
      expect(tree.$.rows.byId('A')).toBeUndefined();
      expect(tree.$.rows.byIdOrFail('B')).toBe(held);
      observation.stage('update-rekeyed');
      tree.$.rows.updateOne('B', { v: 2 });
      await nextTick();
      observation.check('B', 2);
      expect(held()?.v).toBe(2);
    } finally {
      observation.dispose();
      tree.destroy();
    }
  });

  it('retains memo identity across unrelated writes and cleans up switched and stopped observation', async () => {
    const tree = build();
    tree.$.rows.addMany([
      { id: 'A', v: 1 },
      { id: 'B', v: 2 },
    ]);
    tree.$.rows.setActiveId('A');
    const observation = observe(tree);
    const active = tree.$.rows.activeEntity;
    const initial = active.value;
    const changes: (number | undefined)[] = [];
    const dispose = watch(active, (row) => changes.push(row?.v), {
      flush: 'sync',
    });
    try {
      observation.stage('unrelated-field');
      tree.$.rows.updateOne('B', { v: 3 });
      observation.stage('unrelated-membership');
      tree.$.rows.addOne({ id: 'C', v: 4 });
      tree.$.rows.removeOne('C');
      await nextTick();
      observation.check('A', 1);
      expect(active.value).toBe(initial);
      expect(changes).toEqual([]);
      observation.stage('switch-B');
      tree.$.rows.setActiveId('B');
      await nextTick();
      observation.check('B', 3);
      expect(changes).toEqual([3]);
      observation.stage('former-selected-field');
      tree.$.rows.updateOne('A', { v: 5 });
      await nextTick();
      observation.check('B', 3);
      expect(changes).toEqual([3]);
      observation.stage('selected-field');
      tree.$.rows.updateOne('B', { v: 6 });
      await nextTick();
      observation.check('B', 6);
      expect(changes).toEqual([3, 6]);
      dispose();
      tree.$.rows.updateOne('B', { v: 7 });
      await nextTick();
      expect(changes).toEqual([3, 6]);
    } finally {
      dispose();
      observation.dispose();
      tree.destroy();
    }
  });

  it.each([true, false])(
    'preserves independent replay-tap selection across rekey rollback (mixed scalar: %s)',
    (mixed) => {
      const tree = signalTree(
        {
          scalar: 0,
          rows: entityMap<Row, string>({ selectId: (row) => row.id }),
        },
        { enhancers: [transactions()] }
      );
      tree.$.rows.setAll([
        { id: 'A', v: 0 },
        { id: 'C', v: 0 },
      ]);
      tree.$.rows.setActiveId('A');
      const heldA = tree.$.rows.byIdOrFail('A');
      const heldC = tree.$.rows.byIdOrFail('C');
      const seen: { id: string; selection: string | undefined }[] = [];
      let armed = false;
      const untap = tree.$.rows.tap({
        onRemove: (id) => {
          seen.push({ id, selection: tree.$.rows.activeId.value });
          if (armed && id === 'D') tree.$.rows.setActiveId('C');
        },
      });
      try {
        const pending = tree.transact(() => {
          if (mixed) tree.$.scalar.value = 1;
          tree.$.rows.changeId('A', 'X');
          tree.$.rows.addOne({ id: 'D', v: 0 });
        });
        expect(tree.$.rows.activeId.value).toBe('X');
        expect(tree.$.rows.byIdOrFail('X')).toBe(heldA);
        armed = true;
        pending.rollback();
        // Unchanged reviewer oracle: the replay callback must execute and its
        // independent key selection must survive the enclosing settlement.
        expect(seen.some((entry) => entry.id === 'D')).toBe(true);
        expect(tree.$.rows.activeId.value, JSON.stringify(seen)).toBe('C');
        expect(tree.$.scalar.value).toBe(0);
        expect(tree.$.rows.ids.value).toEqual(['A', 'C']);
        expect(tree.$.rows.byIdOrFail('A')).toBe(heldA);
        expect(tree.$.rows.byIdOrFail('C')).toBe(heldC);
        expect(heldA).not.toBe(heldC);
        expect(tree.$.rows.activeEntity.value).toBe(heldC());
      } finally {
        untap();
        tree.destroy();
      }
    }
  );

  it('preserves ABA replay-tap selection of the now absent rekey destination', () => {
    const tree = signalTree(
      {
        scalar: 0,
        rows: entityMap<Row, string>({ selectId: (row) => row.id }),
      },
      { enhancers: [transactions()] }
    );
    tree.$.rows.setAll([
      { id: 'A', v: 0 },
      { id: 'C', v: 0 },
    ]);
    tree.$.rows.setActiveId('A');
    const heldA = tree.$.rows.byIdOrFail('A');
    const seen: { id: string; selection: string | undefined }[] = [];
    let armed = false;
    const untap = tree.$.rows.tap({
      onRemove: (id) => {
        seen.push({ id, selection: tree.$.rows.activeId.value });
        if (armed && id === 'D') {
          tree.$.rows.setActiveId('C');
          tree.$.rows.setActiveId('X');
        }
      },
    });
    try {
      const pending = tree.transact(() => {
        tree.$.scalar.value = 1;
        tree.$.rows.changeId('A', 'X');
        tree.$.rows.addOne({ id: 'D', v: 0 });
      });
      expect(tree.$.rows.activeId.value).toBe('X');
      expect(tree.$.rows.byIdOrFail('X')).toBe(heldA);
      armed = true;
      pending.rollback();
      expect(seen.some((entry) => entry.id === 'D')).toBe(true);
      expect(tree.$.rows.activeId.value, JSON.stringify(seen)).toBe('X');
      expect(tree.$.rows.activeEntity.value).toBeUndefined();
      expect(tree.$.rows.byId('X')).toBeUndefined();
      expect(tree.$.rows.byIdOrFail('A')).toBe(heldA);
      expect(heldA()?.v).toBe(0);
      expect(tree.$.rows.ids.value).toEqual(['A', 'C']);
      expect(tree.$.scalar.value).toBe(0);
    } finally {
      untap();
      tree.destroy();
    }
  });
});
