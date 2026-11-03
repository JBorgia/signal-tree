import { expect, it, vi } from 'vitest';
import { entityMap, signalTree } from '../index';
import { EntityPlacementStage } from './physical/entity-placement-stage';

// A whole N-row installation may process N rows, but must not repeatedly
// traverse each not-yet-admitted suffix while resolving its ordinary anchors.
for (const size of [32, 128, 512, 2048]) {
  it(`fresh setAll ordinary anchor work is linear at ${size}`, () => {
    const original = EntityPlacementStage.prototype.read;
    let reads = 0;
    const spy = vi
      .spyOn(EntityPlacementStage.prototype, 'read')
      .mockImplementation(function (
        this: EntityPlacementStage<string | number>,
        id: number
      ) {
        reads++;
        return original.call(this, id);
      });
    const tree = signalTree({
      rows: entityMap<{ id: number; n: number }, number>(),
    });
    try {
      const input = Array.from({ length: size }, (_, id) => ({ id, n: id }));
      tree.$.rows.setAll(input);
      const operationReads = reads;
      expect(tree.$.rows.ids()).toEqual(input.map((row) => row.id));
      expect(tree.$.rows.all()).toEqual(input);
      expect(operationReads).toBeLessThanOrEqual(30 * size);
    } finally {
      spy.mockRestore();
      tree.destroy();
    }
  });
}
