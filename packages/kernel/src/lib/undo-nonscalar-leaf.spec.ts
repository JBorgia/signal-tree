import { afterEach, describe, expect, it } from 'vitest';
import { undoable } from '../lib/undoable';

import { restoration } from '../enhancers/restoration/restoration';
import { signalTree } from '../index';

/**
 * UNDO REFUSES NON-SCALAR LEAF WRITES — a single plain tree, no marker.
 *
 * RELEASE-1.0.md already records this error message under "cross-tree undo
 * contamination", narrowed to:
 *
 *   form-marker patch + a second WRITTEN restoration tree   THROWS  (:2175)
 *   two PLAIN restoration trees, both written               CLEAN
 *
 * **That narrowing is incomplete.** The same guard fires with ONE tree, NO
 * marker, and no second tree at all — via `applyTurnEffects` (:1673) rather than
 * `applyTurnEffectsThroughRealizationPort` (:2175). The only requirement is that
 * the leaf value is not scalar.
 *
 *   isSupportedEffect, restoration.ts:1680-1694
 *     case 'set': return (isScalarValue(before) && isScalarValue(after))
 *                     || (subject === undefined && ownerPath !== path);
 *
 *   isScalarValue: null | undefined | string | number | boolean | bigint
 *
 * So every non-scalar leaf is affected. Introduced by 06785300 (2026-08-11
 * 22:29, "feat(history): cut over public undo to frontier authority") — empty
 * commit body, same third-bucket commit as SubjectId. The identical scenarios
 * pass on the published 14.x lineage.
 */
/**
 * 2026-10-01 closure for the cases below (historical finding above preserved):
 * undo now admits a registered terminal position instead of inferring support
 * from primitive payload types. The existing cloning path is unchanged.
 * These controls cover number arrays, Date timestamps, string-to-number Maps,
 * string Sets, and a mixed scalar/array turn. They do not establish object-key
 * identity, custom-instance cloning, cycles, or every Map/Set payload policy.
 */
const trees: Array<{ destroy(): void }> = [];
afterEach(() => {
  for (const tree of trees.splice(0)) tree.destroy();
});
const tick = () => new Promise<void>((r) => setTimeout(r, 0));

describe('undo — scalar leaves work', () => {
  it('CONTROL — a number leaf undoes correctly', async () => {
    const tree = signalTree({ n: 0 }, { enhancers: [restoration()] });
    trees.push(tree);
    undoable(() => tree.$.n(1));
    await tick();
    undoable(() => tree.$.n(2));
    await tick();
    tree.undo();
    await tick();
    expect(tree.$.n()).toBe(1);
  });

  it('CONTROL — a string leaf undoes correctly', async () => {
    const tree = signalTree({ s: '' }, { enhancers: [restoration()] });
    trees.push(tree);
    undoable(() => tree.$.s('a'));
    await tick();
    undoable(() => tree.$.s('b'));
    await tick();
    tree.undo();
    await tick();
    expect(tree.$.s()).toBe('a');
  });
});

describe('undo — registered terminal container controls', () => {
  it('ARRAY leaf', async () => {
    const tree = signalTree(
      { rows: [] as number[] },
      { enhancers: [restoration()] }
    );
    trees.push(tree);
    undoable(() => tree.$.rows([1]));
    await tick();
    undoable(() => tree.$.rows([1, 2]));
    await tick();
    tree.undo();
    expect(tree.$.rows()).toEqual([1]);
    tree.redo();
    expect(tree.$.rows()).toEqual([1, 2]);
  });

  it('DATE leaf', async () => {
    const tree = signalTree(
      {
        when: new Date('2020-01-01T00:00:00.000Z'),
      },
      { enhancers: [restoration()] }
    );
    trees.push(tree);
    undoable(() => tree.$.when(new Date('2021-01-01T00:00:00.000Z')));
    await tick();
    undoable(() => tree.$.when(new Date('2022-01-01T00:00:00.000Z')));
    await tick();
    tree.undo();
    expect(tree.$.when()).toEqual(new Date('2021-01-01T00:00:00.000Z'));
    tree.redo();
    expect(tree.$.when()).toEqual(new Date('2022-01-01T00:00:00.000Z'));
  });

  it('MAP leaf', async () => {
    const tree = signalTree(
      {
        lookup: new Map<string, number>(),
      },
      { enhancers: [restoration()] }
    );
    trees.push(tree);
    undoable(() => tree.$.lookup(new Map([['a', 1]])));
    await tick();
    undoable(() => tree.$.lookup(new Map([['a', 2]])));
    await tick();
    tree.undo();
    expect(tree.$.lookup()).toEqual(new Map([['a', 1]]));
    tree.redo();
    expect(tree.$.lookup()).toEqual(new Map([['a', 2]]));
  });

  it('SET leaf', async () => {
    const tree = signalTree(
      { seen: new Set<string>() },
      { enhancers: [restoration()] }
    );
    trees.push(tree);
    undoable(() => tree.$.seen(new Set(['a'])));
    await tick();
    undoable(() => tree.$.seen(new Set(['a', 'b'])));
    await tick();
    tree.undo();
    expect(tree.$.seen()).toEqual(new Set(['a']));
    tree.redo();
    expect(tree.$.seen()).toEqual(new Set(['a', 'b']));
  });

  it('restores scalar and non-scalar siblings together', async () => {
    const tree = signalTree(
      { n: 0, rows: [] as number[] },
      { enhancers: [restoration()] }
    );
    trees.push(tree);
    undoable(() => tree.$.n(1));
    await tick();
    undoable(() => tree.$.n(2));
    undoable(() => tree.$.rows([9]));
    await tick();

    tree.undo();
    expect(tree.$.n()).toBe(1);
    expect(tree.$.rows()).toEqual([]);
    tree.redo();
    expect(tree.$.n()).toBe(2);
    expect(tree.$.rows()).toEqual([9]);
  });
});
