import { expect, it } from 'vitest';
import { EntityPlacementStage } from './entity-placement-stage';
import { EntityOrdinaryTopology } from './entity-ordinary-topology';
import { createPreparedPlacementVisibility } from './prepared-placement-visibility';

it('shares the completed placement order while keeping its captured records immutable', () => {
  const stage = new EntityPlacementStage<string>(
    () => ({ present: false }),
    undefined,
    undefined
  );
  stage.insert(1, 'a');
  stage.insert(2, 'b');
  const early = stage.capturePatch();
  // Final preparation can change adjacency after an earlier key-index scan.
  stage.insert(3, 'c', undefined, 1);
  const final = stage.capturePatch();
  const interval = new EntityOrdinaryTopology<string>().prepareInterval(
    stage,
    final
  );
  const visibility = createPreparedPlacementVisibility(
    stage,
    () => true,
    final
  );
  expect(visibility.resolve(3, 'after')).toBe(3);
  visibility.setVisible(3, false);
  expect(visibility.resolve(3, 'after')).toBe(1);
  expect(final.find(([id]) => id === 1)?.[1]).toEqual({
    present: true,
    key: 'a',
    beforeSubject: 3,
    afterSubject: 2,
  });
  expect(early.find(([id]) => id === 1)?.[1]).toEqual({
    present: true,
    key: 'a',
    beforeSubject: undefined,
    afterSubject: 2,
  });
  expect(Object.isFrozen(final)).toBe(true);
  for (const entry of final) {
    expect(Object.isFrozen(entry)).toBe(true);
    expect(Object.isFrozen(entry[1])).toBe(true);
  }
  stage.remove(1);
  // Retained interval/entries cannot be rewritten by a subsequent preparation.
  expect(interval.pairs.find((pair) => pair.subject === 1)?.after).toEqual({
    present: true,
    key: 'a',
    beforeSubject: 3,
    afterSubject: 2,
  });
  expect(final.find(([id]) => id === 1)?.[1]).toEqual({
    present: true,
    key: 'a',
    beforeSubject: 3,
    afterSubject: 2,
  });
});
