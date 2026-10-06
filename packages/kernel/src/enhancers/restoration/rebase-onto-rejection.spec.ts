import { describe, expect, it } from 'vitest';

import {
  applyCollectionOrderDelta,
  deriveCollectionOrderDelta,
} from '../../lib/internals/causal-runtime/target-transition';
import { rebaseOntoRejection, rebaseOrdersOntoRejection } from './restoration';

/**
 * Unit carriers for `rebaseOntoRejection`, one per pre-image a later record can
 * hold (see its doc comment for the list), and for the order side,
 * `rebaseOrdersOntoRejection` (end-to-end: `rejection-order-rebase.spec.ts`). The end-to-end carriers are in
 * `../transactions/undo-after-rejection.spec.ts`; this file also covers the
 * overlap shapes a rollback refuses before they can reach the rebase (a later
 * write inside or around a row field the rejected turn wrote), so that the
 * rule stays correct if those refusals are ever lifted.
 */
type Effect = Parameters<typeof rebaseOntoRejection>[0][number];

const ROWS = 9;
const row = (
  subject: number,
  segments: string[],
  before: unknown,
  after: unknown,
  presence?: { before: boolean; after: boolean }
): Effect => ({
  kind: 'set',
  position: ROWS,
  ownerPath: 'rows',
  path: `rows.${subject}.${segments.join('.')}`,
  subject,
  fieldSegments: segments,
  ...(presence ? { fieldPresence: presence } : {}),
  before,
  after,
});
const plain = (
  position: number,
  before: unknown,
  after: unknown,
  extra: Partial<Effect> = {}
): Effect =>
  ({
    kind: 'set',
    position,
    ownerPath: 'p',
    path: 'p',
    before,
    after,
    ...extra,
  } as Effect);
const add = (
  subject: number,
  beforeSubject?: number,
  afterSubject?: number
): Effect => ({
  kind: 'add',
  position: ROWS,
  ownerPath: 'rows',
  path: 'rows',
  subject,
  key: `k${subject}`,
  value: { id: `k${subject}` },
  beforeSubject,
  afterSubject,
});
const remove = (
  subject: number,
  value: unknown,
  beforeSubject?: number,
  afterSubject?: number,
  key = `k${subject}`
): Effect => ({
  kind: 'remove',
  position: ROWS,
  ownerPath: 'rows',
  path: 'rows',
  subject,
  key,
  value,
  beforeSubject,
  afterSubject,
});
const rekey = (
  subject: number,
  beforeKey: string,
  afterKey: string
): Effect => ({
  kind: 'rekey',
  position: ROWS,
  ownerPath: 'rows',
  path: 'rows',
  subject,
  beforeKey,
  afterKey,
});

const rebase = (rejected: Effect[], ...lists: Effect[][]) =>
  rebaseOntoRejection(rejected, lists);

describe('rebaseOntoRejection', () => {
  describe('field writes (set)', () => {
    it('re-bases the first later record at the exact address only', () => {
      const [first, second] = rebase(
        [row(1, ['n'], 1, 2)],
        [row(1, ['n'], 2, 3)],
        [row(1, ['n'], 3, 2)]
      );
      expect(first).toStrictEqual([row(1, ['n'], 1, 3)]);
      expect(second).toStrictEqual([row(1, ['n'], 3, 2)]);
    });

    it('claims the address even when the first record does not match', () => {
      const [first, second] = rebase(
        [row(1, ['n'], 1, 2)],
        [row(1, ['n'], 5, 6)],
        [row(1, ['n'], 2, 7)]
      );
      expect(first).toStrictEqual([row(1, ['n'], 5, 6)]);
      expect(second).toStrictEqual([row(1, ['n'], 2, 7)]);
    });

    it('carries presence: a field only the rejected turn added re-bases to absent', () => {
      const [[effect]] = rebase(
        [row(1, ['f'], undefined, 5, { before: false, after: true })],
        [row(1, ['f'], 5, 6)]
      );
      expect(effect).toStrictEqual(
        row(1, ['f'], undefined, 6, { before: false, after: true })
      );
    });

    it('re-bases a write AROUND the rejected one (a whole field over its key)', () => {
      const [[effect]] = rebase(
        [row(1, ['nest', 'x'], 1, 2)],
        [
          row(1, ['nest'], { x: 2, y: 1 }, undefined, {
            before: true,
            after: false,
          }),
        ]
      );
      expect(effect).toStrictEqual(
        row(1, ['nest'], { x: 1, y: 1 }, undefined, {
          before: true,
          after: false,
        })
      );
    });

    it('re-bases writes INSIDE the rejected one, each key claimable once', () => {
      const [first, second, third] = rebase(
        [row(1, ['nest'], { x: 1, y: 1 }, { x: 2, y: 3 })],
        [row(1, ['nest', 'x'], 2, 4)],
        [row(1, ['nest', 'y'], 3, 5)],
        [row(1, ['nest', 'x'], 4, 2)]
      );
      expect(first).toStrictEqual([row(1, ['nest', 'x'], 1, 4)]);
      expect(second).toStrictEqual([row(1, ['nest', 'y'], 1, 5)]);
      expect(third).toStrictEqual([row(1, ['nest', 'x'], 4, 2)]);
    });

    it('a key inside a value that was not a record before re-bases to absent', () => {
      const [[effect]] = rebase(
        [row(1, ['v'], 1, { x: 2 })],
        [row(1, ['v', 'x'], 2, 3)]
      );
      expect(effect).toStrictEqual(
        row(1, ['v', 'x'], undefined, 3, { before: false, after: true })
      );
    });

    it('a plain value is its position plus exact keys, never its display path', () => {
      // Same display path 'p.q', different places: the leaf at position 2 and
      // the key 'q' below position 1 (a literal 'p.q' vs the nested p.q).
      const [[other]] = rebase(
        [plain(2, 1, 2)],
        [plain(1, 2, 3, { branchSegments: ['q'] })]
      );
      expect(other).toStrictEqual(plain(1, 2, 3, { branchSegments: ['q'] }));
      const [[same]] = rebase(
        [plain(1, 1, 2, { branchSegments: ['q'] })],
        [plain(1, 2, 3, { branchSegments: ['q'] })]
      );
      expect(same).toStrictEqual(plain(1, 1, 3, { branchSegments: ['q'] }));
      const [[sibling]] = rebase(
        [plain(1, 1, 2, { branchSegments: ['q'] })],
        [plain(1, 2, 3, { branchSegments: ['r'] })]
      );
      expect(sibling).toStrictEqual(plain(1, 2, 3, { branchSegments: ['r'] }));
    });

    it('matches presence as well as value: a present undefined is not an absent field', () => {
      const [[effect]] = rebase(
        [row(1, ['f'], 1, undefined, { before: true, after: false })],
        [row(1, ['f'], undefined, 2)]
      );
      expect(effect).toStrictEqual(row(1, ['f'], undefined, 2));
    });

    it('a plain-branch member only the rejected turn added re-bases to absent', () => {
      const [[effect]] = rebase(
        [
          plain(2, undefined, 1, {
            plainBranchMembership: { before: false, after: true },
          }),
        ],
        [
          plain(2, 1, undefined, {
            plainBranchMembership: { before: true, after: false },
          }),
        ]
      );
      expect(effect).toStrictEqual(
        plain(2, undefined, undefined, {
          plainBranchMembership: { before: false, after: false },
        })
      );
    });
  });

  describe('row removals', () => {
    it('re-bases the value snapshot field by field: written, added and dropped fields', () => {
      const snapshot = { id: 'k1', n: 2, added: true };
      const [[effect]] = rebase(
        [
          row(1, ['n'], 1, 2),
          row(1, ['added'], undefined, true, { before: false, after: true }),
          row(1, ['dropped'], { x: 1 }, undefined, {
            before: true,
            after: false,
          }),
        ],
        [remove(1, snapshot)]
      );
      expect(effect).toStrictEqual(
        remove(1, { id: 'k1', n: 1, dropped: { x: 1 } })
      );
      expect(snapshot).toStrictEqual({ id: 'k1', n: 2, added: true });
    });

    it("a record's own write to a field claims it before its removal snapshot", () => {
      const [[write, removal]] = rebase(
        [row(1, ['n'], 1, 2)],
        [row(1, ['n'], 2, 5), remove(1, { id: 'k1', n: 5 })]
      );
      expect(write).toStrictEqual(row(1, ['n'], 1, 5));
      expect(removal).toStrictEqual(remove(1, { id: 'k1', n: 5 }));
    });

    it('re-bases the key of a row the rejected turn renamed', () => {
      const [[effect]] = rebase(
        [rekey(1, 'a', 'a2')],
        [remove(1, { id: 'a' }, undefined, undefined, 'a2')]
      );
      expect(effect).toStrictEqual(
        remove(1, { id: 'a' }, undefined, undefined, 'a')
      );
    });
  });

  describe('key order', () => {
    it('re-adds dropped fields in the pre-write order, adjacent drops included', () => {
      const [[effect]] = rebase(
        [
          row(1, ['m'], 1, undefined, {
            before: true,
            after: false,
            successor: 'nest',
          } as never),
          row(1, ['nest'], { x: 1 }, undefined, { before: true, after: false }),
        ],
        [remove(1, { id: 'k1', n: 1, z: 0 })]
      );
      const value = (effect as { value: Record<string, unknown> }).value;
      expect(Object.keys(value)).toStrictEqual(['id', 'n', 'z', 'm', 'nest']);
    });

    it('a dropped field goes back before its successor when that is present', () => {
      const [[effect]] = rebase(
        [
          row(1, ['m'], 1, undefined, {
            before: true,
            after: false,
            successor: 'z',
          } as never),
        ],
        [remove(1, { id: 'k1', n: 1, z: 0 })]
      );
      const value = (effect as { value: Record<string, unknown> }).value;
      expect(Object.keys(value)).toStrictEqual(['id', 'n', 'm', 'z']);
    });

    it('a split record write re-adds its dropped keys in the pre-write order', () => {
      // A later write inside the record splits the rejected record write
      // first; the removal snapshot then re-adds its dropped keys.
      const [, [effect]] = rebase(
        [row(1, ['nest'], { a: 1, b: 2, c: 3 }, { c: 3 })],
        [row(1, ['nest', 'c'], 3, 4)],
        [remove(1, { id: 'k1', nest: { c: 4 } })]
      );
      const value = (effect as { value: { nest: Record<string, unknown> } })
        .value;
      expect(value.nest).toStrictEqual({ a: 1, b: 2, c: 4 });
      expect(Object.keys(value.nest)).toStrictEqual(['a', 'b', 'c']);
    });
  });

  describe('row renames', () => {
    it('never writes back a key a different lifetime holds in a later record', () => {
      const occupier: Effect = { ...add(5), key: 'a' } as Effect;
      const [, [removal]] = rebase(
        [rekey(1, 'a', 'a2')],
        [occupier],
        [remove(1, { id: 'a' }, undefined, undefined, 'a2')]
      );
      expect(removal).toStrictEqual(
        remove(1, { id: 'a' }, undefined, undefined, 'a2')
      );
    });

    it('re-bases the from-key, and drops a rename that became a round trip', () => {
      const [onward] = rebase([rekey(1, 'a', 'a2')], [rekey(1, 'a2', 'a3')]);
      expect(onward).toStrictEqual([rekey(1, 'a', 'a3')]);
      const [back] = rebase([rekey(1, 'a', 'a2')], [rekey(1, 'a2', 'a')]);
      expect(back).toStrictEqual([]);
    });
  });

  describe('rows only the rejected turn created', () => {
    it('drops every later record of them', () => {
      const [records] = rebase(
        [add(5, 1)],
        [
          row(5, ['n'], 1, 2),
          rekey(5, 'k5', 'x'),
          remove(5, {}, 1),
          row(1, ['n'], 0, 1),
        ]
      );
      expect(records).toStrictEqual([row(1, ['n'], 0, 1)]);
    });

    it('follows an anchor to the nearest surviving neighbour, through chains', () => {
      const [[later]] = rebase([add(5, 1), add(6, 5)], [add(7, 6)]);
      expect(later).toStrictEqual(add(7, 1));
    });

    it('prefers the neighbours at an earlier dropped removal over those at creation', () => {
      const [, [later]] = rebase(
        [add(5, 1, 2)],
        [remove(5, {}, 3, 2), remove(1, {}, undefined, 2)],
        [add(7, 5)]
      );
      expect(later).toStrictEqual(add(7, 3));
    });
  });

  describe('own keys', () => {
    it("re-adds a dropped field literally named '__proto__' as an own key", () => {
      // The rejected turn dropped an object-valued field named '__proto__';
      // re-adding it by assignment would set the prototype instead.
      const dropped = { x: 1 };
      const [[effect]] = rebase(
        [
          row(1, ['__proto__'], dropped, undefined, {
            before: true,
            after: false,
          }),
        ],
        [remove(1, { id: 'k1', n: 1 })]
      );
      const value = (effect as { value: Record<string, unknown> }).value;
      expect(Object.getPrototypeOf(value)).toBe(Object.prototype);
      expect(Object.prototype.hasOwnProperty.call(value, '__proto__')).toBe(
        true
      );
      expect(Object.getOwnPropertyDescriptor(value, '__proto__')?.value).toBe(
        dropped
      );
    });
  });

  // Not wall-clock guards in spirit: the bounds are ~50x the measured time
  // and well under what the quadratic scan took at these sizes (seconds).
  describe('scale', () => {
    it('20,000 rejected writes against 20,000 later records of 10 effects', () => {
      const rejected = Array.from({ length: 20_000 }, (_, i) =>
        row(1_000_000 + i, ['n'], 0, 1)
      );
      const lists = Array.from({ length: 20_000 }, (_, l) =>
        Array.from({ length: 10 }, (_, e) =>
          e % 2
            ? remove(l * 20 + e, { id: 'x', n: 1 })
            : row(l * 20 + e, ['m'], 1, 2)
        )
      );
      const started = performance.now();
      rebase(rejected, ...lists);
      expect(performance.now() - started).toBeLessThan(1_500);
    }, 30_000);

    it('a 20,000-key record write against 20,000 later writes to its keys', () => {
      const before: Record<string, number> = {};
      const after: Record<string, number> = {};
      for (let i = 0; i < 20_000; i++) {
        before[`k${i}`] = i;
        after[`k${i}`] = i + 1;
      }
      const lists = Array.from({ length: 20_000 }, (_, i) => [
        plain(3, i + 1, 99, { branchSegments: [`k${i}`] }),
      ]);
      const started = performance.now();
      const out = rebase([plain(3, before, after)], ...lists);
      expect(performance.now() - started).toBeLessThan(1_500);
      expect(out[5][0]).toStrictEqual(
        plain(3, 5, 99, { branchSegments: ['k5'] })
      );
    }, 30_000);
  });
});

describe('rebaseOrdersOntoRejection', () => {
  const OWNER = 4;
  const T_BEFORE = { t: 'before' };
  const T_AFTER = { t: 'after' };
  const W_AFTER = { w: 'after' };
  const COMPENSATED = { c: 'after' };
  // Seed [1, 2]; the rejected turn created 7 ([1, 2, 7]); W reordered and
  // removed it ([2, 1]). Derived while 7 was pending, so 7 is explicit.
  const delta = deriveCollectionOrderDelta(
    OWNER,
    [1, 2, 7],
    [2, 1],
    T_AFTER,
    W_AFTER,
    new Set([7])
  );
  const created = new Map([[OWNER, new Set([7])]]);

  it('takes the rejected rows out of a later delta, exactly', () => {
    const [record] = rebaseOrdersOntoRejection(
      [{ deltas: [delta], frontiers: [] }],
      created,
      [],
      []
    );
    expect(
      applyCollectionOrderDelta([2, 1], record.deltas[0], 'before', W_AFTER)
    ).toStrictEqual([1, 2]);
  });

  it('the first later transition starts from the token the rejected turn replaced; the last ends where the compensation left the collection', () => {
    const [first, second] = rebaseOrdersOntoRejection(
      [
        { deltas: [delta], frontiers: [] },
        {
          deltas: [],
          frontiers: [{ owner: OWNER, before: W_AFTER, after: T_AFTER }],
        },
      ],
      created,
      [{ owner: OWNER, before: T_BEFORE, after: T_AFTER }],
      [{ owner: OWNER, before: T_AFTER, after: COMPENSATED }]
    );
    expect(first.deltas[0].beforeFrontier).toBe(T_BEFORE);
    expect(first.deltas[0].afterFrontier).toBe(W_AFTER);
    expect(second.frontiers).toStrictEqual([
      { owner: OWNER, before: W_AFTER, after: COMPENSATED },
    ]);
  });

  it('leaves tokens that do not meet the rejected or compensated ones', () => {
    const [record] = rebaseOrdersOntoRejection(
      [{ deltas: [delta], frontiers: [] }],
      created,
      [{ owner: OWNER, before: T_BEFORE, after: { other: true } }],
      [{ owner: OWNER, before: { other: true }, after: COMPENSATED }]
    );
    expect(record.deltas[0].beforeFrontier).toBe(T_AFTER);
    expect(record.deltas[0].afterFrontier).toBe(W_AFTER);
  });

  it('a delta left with nothing to reorder is its frontier transition', () => {
    // W only removed the rejected row: [1, 2, 7] -> [1, 2].
    const removal = deriveCollectionOrderDelta(
      OWNER,
      [1, 2, 7],
      [1, 2],
      T_AFTER,
      W_AFTER,
      new Set([7])
    );
    const [record] = rebaseOrdersOntoRejection(
      [{ deltas: [removal], frontiers: [] }],
      created,
      [{ owner: OWNER, before: T_BEFORE, after: T_AFTER }],
      []
    );
    expect(record).toStrictEqual({
      deltas: [],
      frontiers: [{ owner: OWNER, before: T_BEFORE, after: W_AFTER }],
    });
  });
});
