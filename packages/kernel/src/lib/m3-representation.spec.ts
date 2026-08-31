import { describe, expect, it } from 'vitest';

import { signalTree } from './signal-tree';
import { entityMap } from './types';

/**
 * M3 — WHAT THE REPRESENTATION ACTUALLY CONTAINS.
 *
 * Measured rather than read, because `stored.ts` carries two docblocks that
 * disagree: one warns that `tree.$()`/`unwrap()` SKIP stored values, the other
 * records that conforming to the signal/accessor protocol fixed exactly that.
 * Only one can be current.
 */
const mem = () => {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    key: (i: number) => [...m.keys()][i] ?? null,
    get length() {
      return m.size;
    },
  };
};

describe('M3 — representation contents', () => {
  it('entityMap introduces a SYNTHETIC key that has no counterpart in the declaration', () => {
    const tree = signalTree({
      rows: entityMap<{ id: number; n: string }, number>({
        selectId: (e) => e.id,
      }),
      plain: 1,
    });
    tree.$.rows.addOne({ id: 1, n: 'a' });

    // The author wrote `entityMap({ selectId })`. The snapshot says `{ all: [...] }`.
    // The `all` key is invented by the hook's return value, not by the
    // declaration — and a collection's obvious plain-data representation is the
    // array itself.
    expect(tree.$()).toEqual({ rows: { all: [{ id: 1, n: 'a' }] }, plain: 1 });
  });
});
