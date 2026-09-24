import { describe, expect, it } from 'vitest';
import { AUTHORITY_CASES } from './semantics-authority';
import {
  runSupplemental,
  supplementalExitCode,
  type Fixture,
} from './semantics-supplemental';

// Instrumentation only: finite L12 transcripts test unchanged T19/T21 assertions.
// This is neither a candidate implementation nor a native M17 source-mutation
// proof. No ordering resolver, canonical overlay, or oracle table is reused.
const GOOD = {
  'T19/stale-after-newer': [
    [10, 10, 10],
    [2, 2, 10],
  ],
  'T21/out-of-order': [
    [2, 2, 2],
    [11, 11, 11],
    [10, 10, 11],
  ],
} as const;
const ARRIVAL = {
  'T19/stale-after-newer': [
    [10, 10, 10],
    [2, 2, 2],
  ],
  'T21/out-of-order': [
    [2, 2, 2],
    [11, 11, 11],
    [10, 10, 10],
  ],
} as const;
type CaseId = keyof typeof GOOD;
type Step = readonly [revision: number, write: number, observed: number];
type Operation = { kind: string; value?: unknown };
const IDS: readonly CaseId[] = ['T19/stale-after-newer', 'T21/out-of-order'];
const FAULTS = [
  'skip-truth',
  'duplicate-truth',
  'wrong-revision',
  'extra-read',
  'unused-trace',
  'unexpected-settlement',
] as const;
type Fault = (typeof FAULTS)[number];

function scripted(steps: readonly Step[], fault?: Fault) {
  const expected: Operation[] = [];
  for (const [revision, value, observed] of steps) {
    expected.push(
      {
        kind: 'authority',
        value: {
          order: { kind: 'versioned', revision },
          settlement: { kind: 'none' },
        },
      },
      { kind: 'write', value: ['y', value] }
    );
    for (let n = 0; n < 6; n++) expected.push({ kind: 'flush' });
    expected.push(
      { kind: 'visible', value: observed },
      { kind: 'canonical', value: observed }
    );
  }
  if (fault === 'wrong-revision')
    expected[0] = {
      kind: 'authority',
      value: {
        order: { kind: 'versioned', revision: 999 },
        settlement: { kind: 'none' },
      },
    };
  if (fault === 'unused-trace') expected.push({ kind: 'never-called' });
  let cursor = 0,
    disposed = 0,
    inTruth = false;
  const entered: Operation[] = [];
  const consume = (kind: string, value?: unknown): unknown => {
    const operation = { kind, ...(value === undefined ? {} : { value }) };
    entered.push(operation);
    const next = expected[cursor];
    if (!next || next.kind !== kind) {
      throw new Error(
        `Unexpected ${kind} at ${cursor}; expected ${next?.kind ?? 'end'}`
      );
    }
    if (kind !== 'visible' && kind !== 'canonical')
      expect(operation).toEqual(next);
    cursor++;
    return next.value;
  };
  const unexpected = (name: string): never => {
    throw new Error(`Unexpected method ${name}`);
  };
  const fixture: Fixture = {
    candidate: {
      beginContribution: () => unexpected('beginContribution'),
      settleAccept: () => unexpected('settleAccept'),
      settleReject: () => unexpected('settleReject'),
      applyAuthority(event) {
        consume('authority', {
          order: event.order,
          settlement: event.settlement,
        });
        if (typeof event.truth !== 'function')
          throw new Error('Missing authority truth');
        const start = cursor;
        inTruth = true;
        try {
          if (fault !== 'skip-truth') event.truth();
          if (fault === 'duplicate-truth') event.truth();
        } finally {
          inTruth = false;
        }
        if (cursor !== start + 1)
          throw new Error('Authority truth must consume exactly one write');
      },
      readVisible: () => ({ y: consume('visible') }),
      readCanonical: () => ({ y: consume('canonical') }),
      readSettlementState: () => unexpected('readSettlementState'),
      observeVisible: () => unexpected('observeVisible'),
    },
    write(key, value) {
      if (!inTruth) throw new Error('Write outside authority truth');
      consume('write', [key, value]);
    },
    async flush() {
      consume('flush');
    },
    dispose() {
      disposed++;
      expect(disposed).toBe(1);
      if (fault === 'extra-read') fixture.candidate.readVisible();
      if (fault === 'unexpected-settlement')
        fixture.candidate.settleAccept({ __brand: 'contribution' });
      if (cursor !== expected.length)
        throw new Error('Unused operations in authority trace');
    },
    hasPendingAuthority: () => unexpected('hasPendingAuthority'),
    confirmedCount: () => unexpected('confirmedCount'),
  };
  return {
    fixture,
    audit: () => ({
      entered,
      consumed: cursor,
      total: expected.length,
      disposed,
    }),
  };
}

async function execute(id: CaseId, steps: readonly Step[], fault?: Fault) {
  const cases = AUTHORITY_CASES.filter((test) => test.id === id);
  expect(cases).toHaveLength(1);
  const control = scripted(steps, fault);
  const rows = await runSupplemental(
    {
      scalar: async () => control.fixture,
      occupied: async () => {
        throw new Error('Unexpected occupied fixture');
      },
    },
    cases
  );
  expect(rows).toHaveLength(1);
  return { rows, audit: control.audit() };
}

describe('strict authority trace instrument — no native candidate claim', () => {
  it('consumes good, arrival-ordered bad, and restored traces through unchanged T19/T21', async () => {
    for (const id of IDS) {
      const good = await execute(id, GOOD[id]);
      const bad = await execute(id, ARRIVAL[id]);
      const restored = await execute(id, GOOD[id]);
      expect(good.rows[0].status).toBe('held');
      expect(supplementalExitCode(good.rows)).toBe(0);
      expect(good.rows[0].assertions).toHaveLength(id === IDS[0] ? 4 : 6);
      expect(bad.rows[0].status).toBe('violated');
      expect(supplementalExitCode(bad.rows)).toBe(1);
      expect(bad.rows[0].assertions.filter((a) => a.status !== 'held')).toEqual(
        ['visible y', 'canonical y'].map((label) => ({
          label,
          status: 'violated',
          detail: JSON.stringify(
            id === IDS[0]
              ? { actual: 2, expected: 10 }
              : { actual: 10, expected: 11 }
          ),
        }))
      );
      expect(restored.rows).toEqual(good.rows);
      expect(supplementalExitCode(restored.rows)).toBe(0);
      expect(good.audit).toEqual(bad.audit);
      expect(good.audit).toEqual(restored.audit);
      expect(good.audit).toMatchObject({
        consumed: GOOD[id].length * 10,
        total: GOOD[id].length * 10,
        disposed: 1,
      });
      expect(good.audit.entered.filter((op) => op.kind === 'write')).toEqual(
        GOOD[id].map(([, value]) => ({ kind: 'write', value: ['y', value] }))
      );
    }
  });

  it.each(IDS.flatMap((id) => FAULTS.map((fault) => ({ id, fault }))))(
    'rejects protocol error $fault in $id',
    async ({ id, fault }) => {
      const result = await execute(id, GOOD[id], fault);
      expect(result.rows[0].status).toBe('error');
      expect(supplementalExitCode(result.rows)).toBe(1);
      expect(result.rows[0].assertions.some((a) => a.status === 'error')).toBe(
        true
      );
      expect(
        result.rows[0].assertions.some(
          (a) => a.status === 'violated' || a.status === 'unsupported'
        )
      ).toBe(false);
      expect(result.audit.disposed).toBe(1);
    }
  );
});
