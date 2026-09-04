import { computed } from '@angular/core';
import { restoration, undoable } from '@signal-tree/kernel';

import { signalTree } from '../index';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const makeTree = () =>
  signalTree(
    { n: 0 },
    { enhancers: [restoration({ maxHistorySize: 10 })] }
  );

describe('Angular restoration observation', () => {
  it('canUndo flips false to true when the first entry is recorded', async () => {
    const tree = makeTree();
    const canUndo = computed(() => tree.canUndo());
    expect(canUndo()).toBe(false);

    undoable(() => tree.$.n(1));
    await flush();

    expect(canUndo()).toBe(true);
    tree.destroy();
  });

  it('canUndo flips back to false when undone to the start', async () => {
    const tree = makeTree();
    const canUndo = computed(() => tree.canUndo());
    undoable(() => tree.$.n(1));
    await flush();

    tree.undo();
    await flush();

    expect(canUndo()).toBe(false);
    tree.destroy();
  });

  it('canUndo reevaluates after history changes', async () => {
    const tree = makeTree();
    let evaluations = 0;
    const canUndo = computed(() => {
      evaluations++;
      return tree.canUndo();
    });
    canUndo();
    const initial = evaluations;

    undoable(() => tree.$.n(1));
    await flush();
    canUndo();

    expect(evaluations).toBeGreaterThan(initial);
    tree.destroy();
  });

  it('canRedo is false at the end and true after undo', async () => {
    const tree = makeTree();
    const canRedo = computed(() => tree.canRedo());
    undoable(() => tree.$.n(1));
    await flush();
    expect(canRedo()).toBe(false);

    tree.undo();
    await flush();

    expect(canRedo()).toBe(true);
    tree.destroy();
  });

  it('canRedo returns to false after redo', async () => {
    const tree = makeTree();
    const canRedo = computed(() => tree.canRedo());
    undoable(() => tree.$.n(1));
    await flush();
    tree.undo();
    await flush();

    tree.redo();
    await flush();

    expect(canRedo()).toBe(false);
    tree.destroy();
  });

  it('a new write after undo invalidates the redo branch', async () => {
    const tree = makeTree();
    const canRedo = computed(() => tree.canRedo());
    undoable(() => tree.$.n(1));
    await flush();
    tree.undo();
    await flush();
    expect(canRedo()).toBe(true);

    undoable(() => tree.$.n(99));
    await flush();

    expect(canRedo()).toBe(false);
    tree.destroy();
  });

  it('observes restoration history entries appearing', async () => {
    const tree = makeTree();
    const length = computed(() => tree.getRestorationHistory().length);
    const before = length();

    undoable(() => tree.$.n(1));
    await flush();

    expect(length()).toBe(before + 1);
    tree.destroy();
  });

  it('observes restoration history reset', async () => {
    const tree = makeTree();
    const length = computed(() => tree.getRestorationHistory().length);
    undoable(() => tree.$.n(1));
    await flush();
    undoable(() => tree.$.n(2));
    await flush();
    expect(length()).toBeGreaterThan(1);

    tree.resetRestorationHistory();
    await flush();

    expect(length()).toBe(0);
    tree.destroy();
  });
});
