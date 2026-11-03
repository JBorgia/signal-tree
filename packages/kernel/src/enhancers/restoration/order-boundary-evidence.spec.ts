import { describe, expect, it } from 'vitest';
import {
  completeOrderCapture,
  type OrderBoundaryEvidence,
} from './order-boundary-evidence';
const order = (before: unknown, after: unknown, subjects: number[]) => ({
  owner: 1,
  ownerPath: 'rows',
  beforeFrontier: before,
  afterFrontier: after,
  beforeSubjects: subjects,
  afterSubjects: subjects,
});
describe('installed order boundary composition', () => {
  it('does not cross an unrecorded interval', () => {
    const a = {},
      b = {},
      c = {},
      d = {};
    const result = completeOrderCapture(order(a, b, [1]), [
      {
        before: c,
        after: d,
        records: [{ kind: 'add', key: '2', subject: 2, beforeSubject: 1 }],
      },
    ]);
    expect(result.beforeFrontier).toBe(a);
    expect(result.afterFrontier).toBe(b);
    expect(result.afterSubjects).toEqual([1]);
  });
  it('does not replay membership contained by an enclosing explicit order', () => {
    const a = {},
      b = {},
      c = {};
    const result = completeOrderCapture(
      { ...order(a, c, [1]), afterSubjects: [2, 1] },
      [
        {
          before: a,
          after: b,
          records: [{ kind: 'add', key: '2', subject: 2, beforeSubject: 1 }],
        },
      ]
    );
    expect(result.beforeSubjects).toEqual([1]);
    expect(result.afterSubjects).toEqual([2, 1]);
  });
  it('refuses an unavailable placement instead of choosing the head', () => {
    const a = {},
      b = {},
      c = {};
    expect(() =>
      completeOrderCapture(order(a, b, [1]), [
        {
          before: b,
          after: c,
          records: [{ kind: 'add', key: '2', subject: 2, beforeSubject: 99 }],
        },
      ])
    ).toThrow('no placement anchor');
  });
  it.each([16, 128, 1024])(
    'visits each appended record once for %i operations',
    (size) => {
      const tokens = Array.from({ length: size + 1 }, () => ({}));
      let reads = 0;
      const evidence: OrderBoundaryEvidence[] = Array.from(
        { length: size },
        (_, index) => ({
          before: tokens[index],
          after: tokens[index + 1],
          get records() {
            reads++;
            return [
              {
                kind: 'add' as const,
                key: String(index + 2),
                subject: index + 2,
                beforeSubject: index + 1,
              },
            ];
          },
        })
      );
      const result = completeOrderCapture(order({}, tokens[0], [1]), evidence);
      expect(result.afterSubjects).toEqual(
        Array.from({ length: size + 1 }, (_, i) => i + 1)
      );
      expect(reads).toBe(size);
      expect(result.afterFrontier).toBe(tokens[size]);
    }
  );
});
