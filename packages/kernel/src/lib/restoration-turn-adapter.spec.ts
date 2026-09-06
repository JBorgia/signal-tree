import { describe, expect, it } from 'vitest';
import { undoable } from '../lib/undoable';
import { transactions } from '../enhancers/transactions/transactions';

import { entityMap, signalTree, restoration } from '../index';

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

type HistoryStepStore = {
  $: {
    left: { (value: string): void; (update: (current: string) => string): void; (): string };
    right: { (value: string): void; (update: (current: string) => string): void; (): string };
    later: { (value: string): void; (update: (current: string) => string): void; (): string };
  };
  transaction(fn: () => void): { confirm(): void; rollback(): void };
  undo(): void;
  canUndo(): boolean;
  getRestorationHistory(): unknown[];
};

type Row = { id: number; label: string };

type EntityHistoryStepStore = {
  $: {
    rows: {
      addOne(row: Row): void;
      setAll(rows: Row[]): void;
      updateOne(id: number, changes: Partial<Row>): void;
      removeOne(id: number): void;
      changeId(from: number, to: number): void;
      ids(): number[];
      byId(id: number): { label: () => string | undefined } | undefined;
    };
  };
  transaction(fn: () => void): { confirm(): void; rollback(): void };
  undo(): void;
  getRestorationHistory(): unknown[];
};

function createStore(): HistoryStepStore {
  return signalTree(
    { left: 'L0', right: 'R0', later: 'Z0' },
    { enhancers: [restoration(), transactions()] }
  ) as unknown as HistoryStepStore;
}

function createEntityStore(): EntityHistoryStepStore {
  return signalTree(
    {
      rows: entityMap<Row, number>({ selectId: (row) => row.id }),
    },
    { enhancers: [restoration(), transactions()] }
  ) as unknown as EntityHistoryStepStore;
}

describe('restoration turn adapter seam', () => {
  it('confirms several writes as one user-recognizable undo step', async () => {
    const store = createStore();
    const initialHistoryLength = store.getRestorationHistory().length;

    const step = store.transaction(() => {
      undoable(() => store.$.left('L1'));
      undoable(() => store.$.right('R1'));
    });

    expect(store.$.left()).toBe('L1');
    expect(store.$.right()).toBe('R1');
    expect(store.canUndo()).toBe(false);
    expect(store.getRestorationHistory()).toHaveLength(initialHistoryLength);

    step.confirm();
    await tick();

    expect(store.canUndo()).toBe(true);
    expect(store.getRestorationHistory()).toHaveLength(initialHistoryLength + 1);

    store.undo();
    await tick();

    expect(store.$.left()).toBe('L0');
    expect(store.$.right()).toBe('R0');
  });

  it('keeps ordinary writes outside the demarcated step as separate undo steps', async () => {
    const store = createStore();
    const step = store.transaction(() => {
      undoable(() => store.$.left('L1'));
      undoable(() => store.$.right('R1'));
    });
    step.confirm();
    await tick();
    const afterConfirmedStep = store.getRestorationHistory().length;

    undoable(() => store.$.later('Z1'));
    await tick();

    expect(store.getRestorationHistory()).toHaveLength(afterConfirmedStep + 1);

    store.undo();
    await tick();

    expect(store.$.later()).toBe('Z0');
    expect(store.$.left()).toBe('L1');
    expect(store.$.right()).toBe('R1');

    store.undo();
    await tick();

    expect(store.$.left()).toBe('L0');
    expect(store.$.right()).toBe('R0');
  });

  it('does not create a restoration turn when the demarcated callback throws', async () => {
    const store = createStore();
    const initialHistoryLength = store.getRestorationHistory().length;

    expect(() =>
      store.transaction(() => {
        undoable(() => store.$.left('L1'));
        undoable(() => store.$.right('R1'));
        throw new Error('boom');
      })
    ).toThrow('boom');

    await tick();

    expect(store.$.left()).toBe('L0');
    expect(store.$.right()).toBe('R0');
    expect(store.canUndo()).toBe(false);
    expect(store.getRestorationHistory()).toHaveLength(initialHistoryLength);
  });

  it('keeps writes scheduled after the callback outside the demarcated step', async () => {
    const store = createStore();
    const initialHistoryLength = store.getRestorationHistory().length;
    const step = store.transaction(() => {
      undoable(() => store.$.left('L1'));
      void Promise.resolve().then(() =>
        undoable(() => store.$.right('R1'))
      );
    });

    await tick();
    step.confirm();
    await tick();

    expect(store.getRestorationHistory()).toHaveLength(initialHistoryLength + 2);

    store.undo();
    await tick();

    expect(store.$.left()).toBe('L1');
    expect(store.$.right()).toBe('R0');

    store.undo();
    await tick();

    expect(store.$.left()).toBe('L0');
  });

  it('rejects nested demarcation instead of merging step ownership', () => {
    const store = createStore();

    expect(() =>
      store.transaction(() => {
        undoable(() => store.$.left('L1'));
        store.transaction(() => store.$.right('R1'));
      })
    ).toThrow(/nested transaction/i);
  });

  it('confirms structural entity mutations as one user-recognizable undo step', async () => {
    const store = createEntityStore();
    undoable(() => store.$.rows.addOne({ id: 1, label: 'keep' }));
    undoable(() => store.$.rows.addOne({ id: 2, label: 'remove' }));
    await tick();
    const initialHistoryLength = store.getRestorationHistory().length;

    const step = store.transaction(() => {
      undoable(() => store.$.rows.addOne({ id: 3, label: 'add' }));
      undoable(() => store.$.rows.updateOne(1, { label: 'updated' }));
      undoable(() => store.$.rows.removeOne(2));
    });

    expect(store.$.rows.ids()).toEqual([1, 3]);
    expect(store.$.rows.byId(1)?.label()).toBe('updated');
    expect(store.$.rows.byId(2)).toBeUndefined();
    expect(store.$.rows.byId(3)?.label()).toBe('add');

    step.confirm();
    await tick();

    expect(store.getRestorationHistory()).toHaveLength(initialHistoryLength + 1);

    store.undo();
    await tick();

    expect(store.$.rows.ids()).toEqual([1, 2]);
    expect(store.$.rows.byId(1)?.label()).toBe('keep');
    expect(store.$.rows.byId(2)?.label()).toBe('remove');
    expect(store.$.rows.byId(3)).toBeUndefined();
  });

  it('confirms wholesale entity replacement as one user-recognizable undo step', async () => {
    const store = createEntityStore();
    store.$.rows.setAll([
      { id: 1, label: 'keep' },
      { id: 2, label: 'remove' },
    ]);
    await tick();
    const initialHistoryLength = store.getRestorationHistory().length;

    const step = store.transaction(() => {
      undoable(() =>
        store.$.rows.setAll([
          { id: 1, label: 'updated' },
          { id: 3, label: 'add' },
        ])
      );
    });

    expect(store.$.rows.ids()).toEqual([1, 3]);
    expect(store.$.rows.byId(1)?.label()).toBe('updated');
    expect(store.$.rows.byId(2)).toBeUndefined();
    expect(store.$.rows.byId(3)?.label()).toBe('add');

    step.confirm();
    await tick();

    expect(store.getRestorationHistory()).toHaveLength(initialHistoryLength + 1);

    store.undo();
    await tick();

    expect(store.$.rows.ids()).toEqual([1, 2]);
    expect(store.$.rows.byId(1)?.label()).toBe('keep');
    expect(store.$.rows.byId(2)?.label()).toBe('remove');
    expect(store.$.rows.byId(3)).toBeUndefined();
  });

  it('confirms entity rekey with scalar update as one user-recognizable undo step', async () => {
    const store = createEntityStore();
    undoable(() => store.$.rows.addOne({ id: 1, label: 'temp' }));
    await tick();
    const initialHistoryLength = store.getRestorationHistory().length;

    const step = store.transaction(() => {
      undoable(() => store.$.rows.changeId(1, 42));
      undoable(() => store.$.rows.updateOne(42, { label: 'server' }));
    });

    expect(store.$.rows.ids()).toEqual([42]);
    expect(store.$.rows.byId(1)).toBeUndefined();
    expect(store.$.rows.byId(42)?.label()).toBe('server');

    step.confirm();
    await tick();

    expect(store.getRestorationHistory()).toHaveLength(initialHistoryLength + 1);

    store.undo();
    await tick();

    expect(store.$.rows.ids()).toEqual([1]);
    expect(store.$.rows.byId(1)?.label()).toBe('temp');
    expect(store.$.rows.byId(42)).toBeUndefined();
  });
});
