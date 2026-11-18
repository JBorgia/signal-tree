import { expect, it } from 'vitest';
import { orderRestoresForPlacement } from './order-restores-for-placement';

type Restore = { owner: number; subjectId: number; beforeSubject?: number; afterSubject?: number };

function measured(restores: readonly Restore[]) {
  let numericReads = 0, anchorCalls = 0;
  const input = new Proxy(restores, {
    get(target, key, receiver) {
      if (typeof key === 'string' && /^(0|[1-9]\d*)$/.test(key)) numericReads++;
      return Reflect.get(target, key, receiver);
    },
  });
  const ordered = orderRestoresForPlacement(input, value => { anchorCalls++; return value; }, () => false);
  return { ordered, numericReads, anchorCalls };
}

it.each([128, 512])('indexes disconnected cycles without rescanning the input (%i restores)', count => {
  // Separate owners deliberately reuse numeric subject IDs. This synthetic
  // graph checks cycle fallback; public rollback fixtures cover reachable work.
  const input = Array.from({ length: count }, (_, index): Restore => ({
    owner: Math.floor(index / 2), subjectId: index % 2,
    beforeSubject: 1 - index % 2, afterSubject: 1 - index % 2,
  }));
  const result = measured(input);
  expect(result.ordered.every((value, index) => value === input[index])).toBe(true);
  expect(result.ordered).toHaveLength(count);
  expect(result.anchorCalls).toBe(count);
  expect(result.numericReads).toBeLessThanOrEqual(8 * count);
});

it('finds a reversed chain head from the existing index pass', () => {
  const ascending = Array.from({ length: 1024 }, (_, subjectId): Restore => ({
    owner: 0, subjectId,
    beforeSubject: subjectId === 0 ? undefined : subjectId - 1,
    afterSubject: subjectId === 1023 ? undefined : subjectId + 1,
  }));
  const result = measured([...ascending].reverse());
  expect(result.ordered.every((value, index) => value === ascending[index])).toBe(true);
  expect(result.ordered).toHaveLength(ascending.length);
  expect(result.anchorCalls).toBe(ascending.length);
  expect(result.numericReads).toBeLessThanOrEqual(8 * ascending.length);
});
