import { computed } from '@angular/core';
import { describe, expect, it } from 'vitest';

import { entityMap, signalTree } from '../index';

/**
 * DERIVATION E — Angular observation side of the collection null.
 *
 * Recomputation is counted by a `computed` that reads exactly one entry; if it
 * re-runs when a different entry changes, observation is not granular.
 */
type Row = { id: string; n: number };

describe('E — is granular observation obtainable without a collection primitive?', () => {
  it('ARRAY in ordinary state: observation is NOT granular', () => {
    const tree = signalTree({
      rows: [
        { id: 'a', n: 1 },
        { id: 'b', n: 1 },
      ] as Row[],
    });

    let runs = 0;
    const watchA = computed(() => {
      runs++;
      return tree.$.rows().find((r) => r.id === 'a')?.n;
    });
    expect(watchA()).toBe(1);
    const afterFirst = runs;

    tree.$.rows.set([
      { id: 'a', n: 1 },
      { id: 'b', n: 99 },
    ]);
    watchA();

    expect(runs).toBe(afterFirst + 1);
  });

  it('RECORD keyed by id in ordinary state: observation IS granular', () => {
    const tree = signalTree({
      rows: {
        a: { id: 'a', n: 1 },
        b: { id: 'b', n: 1 },
      },
    });

    let runs = 0;
    const watchA = computed(() => {
      runs++;
      return tree.$.rows.a.n();
    });
    expect(watchA()).toBe(1);
    const afterFirst = runs;

    tree.$.rows.b.n.set(99);
    watchA();

    expect(runs).toBe(afterFirst);
    expect(tree.$.rows.b.n()).toBe(99);
  });

  it('entityMap: observation IS granular', () => {
    const tree = signalTree({
      rows: entityMap<Row, string>({ selectId: (r) => r.id }),
    });
    tree.$.rows.addMany([
      { id: 'a', n: 1 },
      { id: 'b', n: 1 },
    ]);

    let runs = 0;
    const watchA = computed(() => {
      runs++;
      return tree.$.rows.byId('a')?.()?.n;
    });
    expect(watchA()).toBe(1);
    const afterFirst = runs;

    tree.$.rows.updateOne('b', { n: 99 });
    watchA();

    expect(runs).toBe(afterFirst);
  });
});
