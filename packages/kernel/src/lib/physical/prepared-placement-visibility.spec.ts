import { expect, it } from 'vitest';
import { EntityPlacementStage } from './entity-placement-stage';
import { createPreparedPlacementVisibility } from './prepared-placement-visibility';
function setup(size = 8, patched = [1, 2, 3, 4, 5]) {
  let reads = 0;
  const visible = new Set<number>([0, 6]);
  const p = new EntityPlacementStage<number>(
    (id) => {
      reads++;
      return id >= 0 && id < size
        ? {
            present: true,
            key: id,
            beforeSubject: id ? id - 1 : undefined,
            afterSubject: id + 1 < size ? id + 1 : undefined,
          }
        : { present: false };
    },
    0,
    size - 1
  );
  for (const id of patched)
    p.patch.set(id, {
      present: true,
      key: id,
      beforeSubject: id ? id - 1 : undefined,
      afterSubject: id + 1 < size ? id + 1 : undefined,
    });
  const q = createPreparedPlacementVisibility(p, (id) => visible.has(id));
  return { p, q, visible, reads: () => reads };
}
it('refreshes negative and positive answers across admission removal and readmission', () => {
  const { q } = setup();
  expect(q.resolve(2, 'after')).toBe(6);
  q.setVisible(3, true);
  expect(q.resolve(2, 'after')).toBe(3);
  q.setVisible(3, false);
  expect(q.resolve(2, 'after')).toBe(6);
  q.setVisible(4, true);
  expect(q.resolve(2, 'after')).toBe(4);
  q.setVisible(4, false);
  q.setVisible(3, true);
  expect(q.resolve(2, 'after')).toBe(3);
});
it('excluded invisible or visible member is a hard stop', () => {
  const { q } = setup();
  expect(q.resolve(2, 'after', 4)).toBeUndefined();
  q.setVisible(4, true);
  expect(q.resolve(2, 'after', 4)).toBeUndefined();
  q.setVisible(3, true);
  expect(q.resolve(2, 'after', 4)).toBe(3);
  expect(q.resolve(4, 'before', 4)).toBeUndefined();
});
it('crosses disconnected indexed runs and resolves ordinary-only anchors before physical absence', () => {
  const { q } = setup(8, [1, 2, 4, 5]);
  q.setVisible(5, true);
  expect(q.resolve(1, 'after')).toBe(5);
  q.setVisible(3, true);
  expect(q.resolve(1, 'after')).toBe(3);
  q.setVisible(99, true);
  expect(q.resolve(99, 'after')).toBe(99);
  q.setVisible(99, false);
  expect(q.resolve(99, 'after')).toBeUndefined();
});
it.each([16, 1024, 65536])(
  'local index avoids unrelated physical reads at %i rows',
  (size) => {
    const { q, reads } = setup(size);
    q.setVisible(3, true);
    expect(reads()).toBe(0);
    for (let n = 0; n < 20; n++) {
      q.setVisible(3, n % 2 === 0);
      expect(q.resolve(2, 'after')).toBe(n % 2 === 0 ? 3 : 6);
    }
    expect(reads()).toBeLessThanOrEqual(30);
  }
);
it('stops malformed cyclic physical traversal without inventing placement', () => {
  const p = new EntityPlacementStage<number>(
    (id) => ({ present: true, key: id, afterSubject: id === 1 ? 2 : 1 }),
    1,
    2
  );
  p.patch.set(1, { present: true, key: 1, afterSubject: 2 });
  p.patch.set(2, { present: true, key: 2, beforeSubject: 1, afterSubject: 1 });
  const q = createPreparedPlacementVisibility(p, () => false);
  expect(q.resolve(1, 'after')).toBeUndefined();
});

it('backward queries and rekey visibility updates preserve current nearest identity', () => {
  const { q } = setup();
  expect(q.resolve(5, 'before')).toBe(0);
  q.setVisible(4, true);
  expect(q.resolve(5, 'before')).toBe(4);
  q.setVisible(4, false);
  q.setVisible(2, true);
  expect(q.resolve(5, 'before')).toBe(2);
  expect(q.resolve(5, 'before', 3)).toBeUndefined();
});
