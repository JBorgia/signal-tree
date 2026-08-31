import { describe, expect, it, vi } from 'vitest';

import { restoration } from '../enhancers/restoration/restoration';
import { external } from './external';
import { getPathNotifier, resetPathNotifier } from './path-notifier';
import { signalTree } from './signal-tree';
import { undoable } from './undoable';

const flush = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
};

describe('SNAPSHOT-IDENTITY-CONTRACT-0', () => {
  it('keeps the public root snapshot stable while committed truth is unchanged', () => {
    const tree = signalTree({ count: 1, nested: { value: 2 } });
    const first = tree();

    expect(tree()).toBe(first);
    tree.$.count.set(1);
    expect(tree()).toBe(first);

    tree.$.count.set(2);
    expect(tree()).not.toBe(first);
  });

  it('keeps two committed A-to-B and B-to-A transitions as two causal turns', async () => {
    const tree = signalTree(
      { value: 'A' },
      { enhancers: [restoration()] }
    );
    const initial = tree();
    const baseline = tree.getRestorationHistory().length;

    undoable(() => tree.$.value.set('B'));
    await flush();
    undoable(() => tree.$.value.set('A'));
    await flush();

    expect(tree()).toEqual(initial);
    expect(tree.getRestorationHistory()).toHaveLength(baseline + 2);
  });

  it('suppresses same-turn scalar net zero from causal effects, not snapshots', async () => {
    const tree = signalTree(
      { value: 'A' },
      { enhancers: [restoration()] }
    );
    const baseline = tree.getRestorationHistory().length;

    undoable(() => {
      tree.$.value.set('B');
      tree.$.value.set('A');
    });
    await flush();

    expect(tree().value).toBe('A');
    expect(tree.getRestorationHistory()).toHaveLength(baseline);
  });

  it('classifies equivalent final truth as realized from write metadata', async () => {
    resetPathNotifier();
    const tree = signalTree(
      { value: 'A' },
      { enhancers: [restoration()] }
    );
    const initial = tree();
    const baseline = tree.getRestorationHistory().length;
    const participation: Array<string | undefined> = [];
    const unsubscribe = getPathNotifier().subscribe(
      'value',
      (_value, _previous, _path, _ownerPath, _origin, _subjectIds, _positionIds, meta) => {
        participation.push(meta?.participation);
      }
    );

    external(() => tree.$.value.set('B'));
    await flush();
    external(() => tree.$.value.set('A'));
    await flush();
    unsubscribe();

    expect(tree()).toEqual(initial);
    expect(participation).toEqual(['realized', 'realized']);
    expect(tree.getRestorationHistory()).toHaveLength(baseline);
  });

  it('does not require descendant identity for the public stable-root law', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      const tree = signalTree({ left: { value: 1 }, right: { value: 2 } });
      const before = tree();
      tree.$.left.value.set(3);
      const after = tree();

      expect(after).not.toBe(before);
      expect(after).toEqual({ left: { value: 3 }, right: { value: 2 } });
    } finally {
      warn.mockRestore();
    }
  });
});
