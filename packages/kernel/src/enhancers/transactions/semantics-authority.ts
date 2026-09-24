/** Frozen authority assertions only; no canonical overlay or ordering model. */
import { UnsupportedSemantic, type Handle } from './semantics-contract';
import type {
  Context,
  Fixture,
  SupplementalCase,
} from './semantics-supplemental';

// A missing reader must not erase a separately measurable violation. Only the
// explicit capability marker is deferred; unexpected execution errors propagate.
function claims(checks: (() => void)[]): void {
  const missing: string[] = [];
  for (const check of checks) {
    try {
      check();
    } catch (error) {
      if (!(error instanceof UnsupportedSemantic)) throw error;
      missing.push(error.message);
    }
  }
  if (missing.length) throw new UnsupportedSemantic(missing.join('; '));
}
const flush = async (f: Fixture) => {
  for (let i = 0; i < 6; i++) await f.flush();
};
const visible = (f: Fixture, c: Context, y: number) =>
  c.equal(f.candidate.readVisible().y, y, 'visible y');
const canonical = (f: Fixture, c: Context, y: number) =>
  c.equal(f.candidate.readCanonical().y, y, 'canonical y');
const pending = (f: Fixture, c: Context, p: Handle, label = 'P') =>
  c.equal(
    f.candidate.readSettlementState(p),
    { disposition: 'pending', retainsAuthority: true },
    `${label} pending independently of canonical advancement`
  );
const accepted = (f: Fixture, c: Context, p: Handle) => {
  const view = f.candidate.readSettlementState(p);
  c.check(
    view.disposition === 'committed' || view.disposition === 'superseded',
    'accepted P has a committed/superseded disposition',
    JSON.stringify(view)
  );
  c.equal(view.retainsAuthority, false, 'accepted P releases authority');
};
const begin = async (f: Fixture, y: number) => {
  const p = f.candidate.beginContribution(() => f.write('y', y));
  await flush(f);
  return p;
};
const revision = async (f: Fixture, rev: number, y: number) => {
  f.candidate.applyAuthority({
    truth: () => f.write('y', y),
    order: { kind: 'versioned', revision: rev },
    settlement: { kind: 'none' },
  });
  await flush(f);
};

export const AUTHORITY_CASES: SupplementalCase[] = [
  {
    id: 'A1/unrelated-snapshot',
    scope: 'L11 canonical advancement and pending survival are independent',
    async run(f, c) {
      const p = await begin(f, 1);
      f.candidate.applyAuthority({
        truth: () => f.write('y', 7),
        order: { kind: 'snapshot' },
        settlement: { kind: 'none' },
      });
      await flush(f);
      claims([
        () => visible(f, c, 1),
        () => pending(f, c, p),
        () => canonical(f, c, 7),
      ]);
    },
  },
  {
    id: 'A2/correlated-accept',
    scope: 'L11 snapshot and explicit acceptance on one event',
    async run(f, c) {
      const p = await begin(f, 1);
      f.candidate.applyAuthority({
        truth: () => f.write('y', 1),
        order: { kind: 'snapshot' },
        settlement: { kind: 'accepts', contribution: p },
      });
      await flush(f);
      claims([
        () => visible(f, c, 1),
        () => accepted(f, c, p),
        () => canonical(f, c, 1),
      ]);
    },
  },
  {
    id: 'A3/correlated-reject',
    scope: 'L11 rejection removes contribution while truth advances',
    async run(f, c) {
      const p = await begin(f, 1);
      f.candidate.applyAuthority({
        truth: () => f.write('y', 7),
        order: { kind: 'snapshot' },
        settlement: { kind: 'rejects', contribution: p },
      });
      await flush(f);
      claims([
        () => visible(f, c, 7),
        () =>
          c.equal(
            f.candidate.readSettlementState(p),
            { disposition: 'rejected', retainsAuthority: false },
            'P explicitly rejected without authority'
          ),
        () => canonical(f, c, 7),
      ]);
    },
  },
  {
    id: 'A4/included-through',
    scope:
      'L11 included truth prevents resurrection; no unique disposition imposed',
    async run(f, c) {
      const p = await begin(f, 1);
      f.candidate.applyAuthority({
        truth: () => f.write('y', 9),
        order: { kind: 'snapshot' },
        settlement: { kind: 'includes', contribution: p },
      });
      await flush(f);
      claims([() => visible(f, c, 9), () => canonical(f, c, 9)]);
      const view = f.candidate.readSettlementState(p);
      c.note(view);
      if (view.retainsAuthority) {
        c.requireSuccess(
          f.candidate.settleAccept(p),
          'remaining included contribution accepts successfully'
        );
        await flush(f);
        claims([() => visible(f, c, 9), () => canonical(f, c, 9)]);
      }
    },
  },
  {
    id: 'A5/fresh-revision-no-relation',
    scope: 'L11/L12 numeric freshness does not establish settlement',
    async run(f, c) {
      await revision(f, 2, 0);
      const p = await begin(f, 1);
      await revision(f, 10, 7);
      claims([
        () => visible(f, c, 1),
        () => pending(f, c, p),
        () => canonical(f, c, 7),
      ]);
    },
  },
  {
    id: 'A6/stale-version',
    scope: 'L12 stale numeric revision cannot regress canonical truth',
    async run(f, c) {
      await revision(f, 10, 7);
      await revision(f, 2, 2);
      claims([() => visible(f, c, 7), () => canonical(f, c, 7)]);
    },
  },
  ...(
    [
      [
        'T18/newer-version',
        [
          [2, 2, 2],
          [10, 10, 10],
        ],
      ],
      [
        'T19/stale-after-newer',
        [
          [10, 10, 10],
          [2, 2, 10],
        ],
      ],
      [
        'T21/out-of-order',
        [
          [2, 2, 2],
          [11, 11, 11],
          [10, 10, 11],
        ],
      ],
    ] as const
  ).map(
    ([id, steps]): SupplementalCase => ({
      id,
      scope:
        'L12 exact numeric revision checkpoints, neither lexical nor arrival order',
      async run(f, c) {
        for (const [rev, value, expected] of steps) {
          c.note({ revision: rev, value, expected });
          await revision(f, rev, value);
          claims([
            () => visible(f, c, expected),
            () => canonical(f, c, expected),
          ]);
        }
      },
    })
  ),
  {
    id: 'T20/older-response-newer-intent',
    scope:
      'L11/L12 local authorship, authority revision and settlement relation are orthogonal',
    async run(f, c) {
      const p = await begin(f, 1),
        q = await begin(f, 2);
      f.candidate.applyAuthority({
        truth: () => f.write('y', 1),
        order: { kind: 'versioned', revision: 11 },
        settlement: { kind: 'accepts', contribution: p },
      });
      await flush(f);
      claims([
        () => visible(f, c, 2),
        () => accepted(f, c, p),
        () => pending(f, c, q, 'Q'),
        () => canonical(f, c, 1),
      ]);
    },
  },
  {
    id: 'T22/unordered-no-invented-authority',
    scope:
      'L12 unknown/conflict is not authority order; no visible conflict policy imposed',
    async run(f, c) {
      const p = await begin(f, 1);
      f.candidate.applyAuthority({
        truth: () => f.write('y', 9),
        order: { kind: 'unordered' },
        settlement: { kind: 'none' },
      });
      await flush(f);
      claims([
        () => {
          const view = f.candidate.readSettlementState(p);
          c.check(
            view.disposition === 'pending' || view.disposition === 'conflicted',
            'unordered claim cannot invent terminal settlement',
            JSON.stringify(view)
          );
          c.equal(
            view.retainsAuthority,
            true,
            'unresolved P retains settlement authority'
          );
        },
        () => canonical(f, c, 0),
      ]);
    },
  },
];
