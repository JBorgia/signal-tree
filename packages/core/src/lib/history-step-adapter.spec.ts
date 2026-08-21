import { describe, expect, it } from 'vitest';

import { signalTree, timeTravel } from '../index';

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

function createStore(): HistoryStepStore {
  return signalTree({ left: 'L0', right: 'R0', later: 'Z0' }).with(
    timeTravel()
  ) as unknown as HistoryStepStore;
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
});
