import { describe, expect, it } from 'vitest';
import { entityMap, link, signalTree } from '../index';

// The retired codec's malformed/versioned envelope cases are deleted with it.
// Preserve its independent control: plain values and entity rows survive transfer
// between actual trees, through application-owned JSON and public Link inputs.
describe('plain and entity values cross an application JSON boundary', () => {
  it('preserves count and every entity', async () => {
    const make = () =>
      signalTree({
        count: 0,
        rows: entityMap<{ id: number; n: string }, number>(),
      });
    const a = make();
    const b = make();
    a.$.count(7);
    a.$.rows.addMany([
      { id: 1, n: 'x' },
      { id: 2, n: 'y' },
    ]);
    const data = JSON.parse(JSON.stringify(a.$())) as {
      count: number;
      rows: { all: { id: number; n: string }[] };
    };
    const count = link(b.$.count, { get: () => data.count });
    const rows = link(b.$.rows, { get: () => data.rows.all });
    try {
      await count.retrieve();
      await rows.retrieve();
      expect(b.$.count()).toBe(7);
      expect(b.$.rows.count()).toBe(2);
      expect(b.$.rows.all()).toEqual(a.$.rows.all());
    } finally {
      count.dispose();
      rows.dispose();
      a.destroy();
      b.destroy();
    }
  });
});
