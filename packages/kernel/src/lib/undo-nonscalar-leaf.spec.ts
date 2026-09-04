import { describe, expect, it } from 'vitest';
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
const tick = () => new Promise<void>((r) => setTimeout(r, 0));

describe('undo — scalar leaves work', () => {
  it('CONTROL — a number leaf undoes correctly', async () => {
    const tree = signalTree({ n: 0 }, { enhancers: [restoration()] });
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
    undoable(() => tree.$.s('a'));
    await tick();
    undoable(() => tree.$.s('b'));
    await tick();
    tree.undo();
    await tick();
    expect(tree.$.s()).toBe('a');
  });
});

describe('undo — every NON-SCALAR leaf throws, one tree, no marker', () => {
  it('ARRAY leaf', async () => {
    const tree = signalTree(
      { rows: [] as number[] },
      { enhancers: [restoration()] }
    );
    undoable(() => tree.$.rows([1]));
    await tick();
    undoable(() => tree.$.rows([1, 2]));
    await tick();
    expect(() => tree.undo()).toThrow(/Unsupported scoped undo effect at rows/);
  });

  it('DATE leaf', async () => {
    const tree = signalTree(
      {
        when: new Date('2020-01-01T00:00:00.000Z'),
      },
      { enhancers: [restoration()] }
    );
    undoable(() => tree.$.when(new Date('2021-01-01T00:00:00.000Z')));
    await tick();
    undoable(() => tree.$.when(new Date('2022-01-01T00:00:00.000Z')));
    await tick();
    expect(() => tree.undo()).toThrow(/Unsupported scoped undo effect at when/);
  });

  it('MAP leaf', async () => {
    const tree = signalTree(
      {
        lookup: new Map<string, number>(),
      },
      { enhancers: [restoration()] }
    );
    undoable(() => tree.$.lookup(new Map([['a', 1]])));
    await tick();
    undoable(() => tree.$.lookup(new Map([['a', 2]])));
    await tick();
    expect(() => tree.undo()).toThrow(
      /Unsupported scoped undo effect at lookup/
    );
  });

  it('SET leaf', async () => {
    const tree = signalTree(
      { seen: new Set<string>() },
      { enhancers: [restoration()] }
    );
    undoable(() => tree.$.seen(new Set(['a'])));
    await tick();
    undoable(() => tree.$.seen(new Set(['a', 'b'])));
    await tick();
    expect(() => tree.undo()).toThrow(/Unsupported scoped undo effect at seen/);
  });

  it('AND a scalar sibling is collateral — the whole undo turn is refused', async () => {
    // The throw is not scoped to the offending position. `applyTurnEffects`
    // validates the WHOLE effect list before applying any of it, so one
    // non-scalar leaf in a turn takes the scalar writes down with it.
    const tree = signalTree(
      { n: 0, rows: [] as number[] },
      { enhancers: [restoration()] }
    );
    undoable(() => tree.$.n(1));
    await tick();
    undoable(() => tree.$.n(2));
    undoable(() => tree.$.rows([9]));
    await tick();

    expect(() => tree.undo()).toThrow(/Unsupported scoped undo effect/);
    // n is stranded at 2 — the undo the user asked for did not happen at all.
    expect(tree.$.n()).toBe(2);
  });
});
