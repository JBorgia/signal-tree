import { describe, expect, it } from 'vitest';

import { entityMap, signalTree, timeTravel } from '../index';

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

type HistoryStepStore = {
  $: {
    left: { (): string; set(value: string): void };
    right: { (): string; set(value: string): void };
    later: { (): string; set(value: string): void };
  };
  transaction(fn: () => void): { confirm(): void; rollback(): void };
  undo(): void;
  canUndo(): boolean;
  getHistory(): unknown[];
};

type Row = { id: number; label: string };

type EntityHistoryStepStore = {
  $: {
    rows: {
      addOne(row: Row): void;
      setAll(rows: Row[]): void;
      updateOne(id: number, changes: Partial<Row>): void;
      removeOne(id: number): void;
      ids(): number[];
      byId(id: number): { label: () => string | undefined } | undefined;
    };
  };
  transaction(fn: () => void): { confirm(): void; rollback(): void };
  undo(): void;
  getHistory(): unknown[];
};

function createStore(): HistoryStepStore {
  return signalTree({ left: 'L0', right: 'R0', later: 'Z0' }).with(
    timeTravel()
  ) as unknown as HistoryStepStore;
}

function createEntityStore(): EntityHistoryStepStore {
  return signalTree({
    rows: entityMap<Row, number>({ selectId: (row) => row.id }),
  }).with(timeTravel()) as unknown as EntityHistoryStepStore;
}

describe('history step adapter seam', () => {
  it('confirms several writes as one user-recognizable undo step', async () => {
    const store = createStore();
    const initialHistoryLength = store.getHistory().length;

    const step = store.transaction(() => {
      store.$.left.set('L1');
      store.$.right.set('R1');
    });

    expect(store.$.left()).toBe('L1');
    expect(store.$.right()).toBe('R1');
    expect(store.canUndo()).toBe(false);
    expect(store.getHistory()).toHaveLength(initialHistoryLength);

    step.confirm();
    await tick();

    expect(store.canUndo()).toBe(true);
    expect(store.getHistory()).toHaveLength(initialHistoryLength + 1);

    store.undo();
    await tick();

    expect(store.$.left()).toBe('L0');
    expect(store.$.right()).toBe('R0');
  });

  it('keeps ordinary writes outside the demarcated step as separate undo steps', async () => {
    const store = createStore();
    const step = store.transaction(() => {
      store.$.left.set('L1');
      store.$.right.set('R1');
    });
    step.confirm();
    await tick();
    const afterConfirmedStep = store.getHistory().length;

    store.$.later.set('Z1');
    await tick();

    expect(store.getHistory()).toHaveLength(afterConfirmedStep + 1);

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

  it('does not create a history step when the demarcated callback throws', async () => {
    const store = createStore();
    const initialHistoryLength = store.getHistory().length;

    expect(() =>
      store.transaction(() => {
        store.$.left.set('L1');
        store.$.right.set('R1');
        throw new Error('boom');
      })
    ).toThrow('boom');

    await tick();

    expect(store.$.left()).toBe('L0');
    expect(store.$.right()).toBe('R0');
    expect(store.canUndo()).toBe(false);
    expect(store.getHistory()).toHaveLength(initialHistoryLength);
  });

  it('keeps writes scheduled after the callback outside the demarcated step', async () => {
    const store = createStore();
    const initialHistoryLength = store.getHistory().length;
    const step = store.transaction(() => {
      store.$.left.set('L1');
      void Promise.resolve().then(() => store.$.right.set('R1'));
    });

    await tick();
    step.confirm();
    await tick();

    expect(store.getHistory()).toHaveLength(initialHistoryLength + 2);

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
        store.$.left.set('L1');
        store.transaction(() => store.$.right.set('R1'));
      })
    ).toThrow(/nested transaction/i);
  });

  it('confirms structural entity mutations as one user-recognizable undo step', async () => {
    const store = createEntityStore();
    store.$.rows.addOne({ id: 1, label: 'keep' });
    store.$.rows.addOne({ id: 2, label: 'remove' });
    await tick();
    const initialHistoryLength = store.getHistory().length;

    const step = store.transaction(() => {
      store.$.rows.addOne({ id: 3, label: 'add' });
      store.$.rows.updateOne(1, { label: 'updated' });
      store.$.rows.removeOne(2);
    });

    expect(store.$.rows.ids()).toEqual([1, 3]);
    expect(store.$.rows.byId(1)?.label()).toBe('updated');
    expect(store.$.rows.byId(2)).toBeUndefined();
    expect(store.$.rows.byId(3)?.label()).toBe('add');

    step.confirm();
    await tick();

    expect(store.getHistory()).toHaveLength(initialHistoryLength + 1);

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
    const initialHistoryLength = store.getHistory().length;

    const step = store.transaction(() => {
      store.$.rows.setAll([
        { id: 1, label: 'updated' },
        { id: 3, label: 'add' },
      ]);
    });

    expect(store.$.rows.ids()).toEqual([1, 3]);
    expect(store.$.rows.byId(1)?.label()).toBe('updated');
    expect(store.$.rows.byId(2)).toBeUndefined();
    expect(store.$.rows.byId(3)?.label()).toBe('add');

    step.confirm();
    await tick();

    expect(store.getHistory()).toHaveLength(initialHistoryLength + 1);

    store.undo();
    await tick();

    expect(store.$.rows.ids()).toEqual([1, 2]);
    expect(store.$.rows.byId(1)?.label()).toBe('keep');
    expect(store.$.rows.byId(2)?.label()).toBe('remove');
    expect(store.$.rows.byId(3)).toBeUndefined();
  });
});
