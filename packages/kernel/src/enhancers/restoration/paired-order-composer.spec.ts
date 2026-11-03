import { expect, it } from 'vitest';
import {
  completeOrderCapture,
  type OrderBoundaryEvidence,
} from './order-boundary-evidence';
import type { TopologyViewInterval } from '../../lib/internals/mutation-capture-runtime';
const interval = (
  before: object,
  after: object,
  from: readonly number[],
  to: readonly number[]
): TopologyViewInterval => ({
  before,
  after,
  pairs: [...new Set([...from, ...to])].map((subject) => ({
    subject,
    before: from.includes(subject)
      ? {
          present: true,
          key: subject,
          beforeSubject: from[from.indexOf(subject) - 1],
          afterSubject: from[from.indexOf(subject) + 1],
        }
      : { present: false },
    after: to.includes(subject)
      ? {
          present: true,
          key: subject,
          beforeSubject: to[to.indexOf(subject) - 1],
          afterSubject: to[to.indexOf(subject) + 1],
        }
      : { present: false },
  })),
});
it('completes physical and ordinary continuity independently without promoting an inspection member', () => {
  const p0 = {},
    p1 = {},
    p2 = {},
    o0 = {},
    o1 = {};
  const physical = interval(p1, p2, [1, 9], [1, 9, 2]),
    ordinary = interval(o0, o1, [1], [1, 2]);
  const evidence: OrderBoundaryEvidence[] = [
    { before: p1, after: p2, records: [], physical, ordinary },
  ];
  const result = completeOrderCapture(
    {
      owner: 1,
      ownerPath: 'rows',
      beforeFrontier: p0,
      afterFrontier: p1,
      beforeSubjects: [1, 9],
      afterSubjects: [1, 9],
      ordinaryEndpoints: {
        before: [1],
        after: [1],
        domain: [1],
        beforeToken: o0,
        afterToken: o0,
      },
    },
    evidence
  );
  expect(result.afterSubjects).toEqual([1, 9, 2]);
  expect(result.ordinaryEndpoints.after).toEqual([1, 2]);
  expect(result.ordinaryEndpoints.afterToken).toBe(o1);
  expect(evidence[0].ordinary).toBe(ordinary);
  expect(ordinary.pairs).toHaveLength(2);
});
it('does not bridge a missing ordinary interval through contiguous physical evidence', () => {
  const p0 = {},
    p1 = {},
    p2 = {},
    o0 = {},
    o1 = {},
    o2 = {};
  const result = completeOrderCapture(
    {
      owner: 1,
      ownerPath: 'rows',
      beforeFrontier: p0,
      afterFrontier: p1,
      beforeSubjects: [1],
      afterSubjects: [1],
      ordinaryEndpoints: {
        before: [1],
        after: [1],
        domain: [1],
        beforeToken: o0,
        afterToken: o0,
      },
    },
    [
      {
        before: p1,
        after: p2,
        records: [],
        physical: interval(p1, p2, [1], [1, 2]),
        ordinary: interval(o1, o2, [1], [1, 2]),
      },
    ]
  );
  expect(result.afterSubjects).toEqual([1, 2]);
  expect(result.ordinaryEndpoints.after).toEqual([1]);
  expect(result.ordinaryEndpoints.afterToken).toBe(o0);
});
it('reverses completed touched adjacency before a selected explicit order', () => {
  const p0 = {},
    p1 = {},
    p2 = {},
    o0 = {},
    o1 = {},
    o2 = {};
  const result = completeOrderCapture(
    {
      owner: 1,
      ownerPath: 'rows',
      beforeFrontier: p1,
      afterFrontier: p2,
      beforeSubjects: [1, 2, 3],
      afterSubjects: [3, 2, 1],
      ordinaryEndpoints: {
        before: [1, 2, 3],
        after: [3, 2, 1],
        domain: [1, 2, 3],
        beforeToken: o1,
        afterToken: o2,
      },
    },
    [
      {
        before: p0,
        after: p1,
        records: [],
        physical: interval(p0, p1, [1, 3], [1, 2, 3]),
        ordinary: interval(o0, o1, [1, 3], [1, 2, 3]),
      },
    ]
  );
  expect(result.beforeSubjects).toEqual([1, 3]);
  expect(result.ordinaryEndpoints.before).toEqual([1, 3]);
  expect(result.ordinaryEndpoints.after).toEqual([3, 2, 1]);
});
