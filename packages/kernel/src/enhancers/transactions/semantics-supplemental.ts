/** Supplemental evidence only. The original thirteen cases remain unchanged. */
import {
  UnsupportedSemantic,
  type CandidateFactory,
  type Handle,
  type Snapshot,
  type SettlementResult,
} from './semantics-contract';

import type { CompositionJobs } from './semantics-composition-domain';
import type { EntityDomain } from './semantics-structural-domain';

export type Fixture = Awaited<ReturnType<CandidateFactory>> & {
  /** Actual native membership, never an inferred terminal disposition. */
  hasPendingAuthority(handle: Handle): boolean;
  confirmedCount(): number;
  domain?: EntityDomain;
  composition?: CompositionJobs;
  prepareConflict?: () => Promise<Handle>;
  resolveConflict?: () => Promise<void>;
};
export type Factories = {
  scalar: () => Promise<Fixture>;
  occupied: () => Promise<Fixture>;
  structural?: () => Promise<Fixture>;
};
export type Status =
  | 'held'
  | 'violated'
  | 'unsupported'
  | 'not-exercised'
  | 'error';
export type Assertion = { label: string; status: Status; detail?: string };
export type Evidence = {
  id: string;
  scope: string;
  status: Status;
  assertions: Assertion[];
  trace: unknown[];
};
export type Context = {
  check(ok: boolean, label: string, detail?: string): void;
  equal(actual: unknown, expected: unknown, label: string): void;
  requireSuccess(result: SettlementResult, label: string): void;
  note(value: unknown): void;
};
export type SupplementalCase = {
  id: string;
  scope: string;
  fixture?: keyof Factories;
  run(f: Fixture, c: Context): Promise<void>;
};
class FailedPrecondition extends Error {}
export class NotExercised extends Error {}
const same = (a: unknown, b: unknown): boolean => {
  if (Object.is(a, b)) return true;
  if (
    a === null ||
    b === null ||
    typeof a !== 'object' ||
    typeof b !== 'object'
  )
    return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const left = a as Record<string, unknown>,
    right = b as Record<string, unknown>;
  return (
    Object.keys(left).length === Object.keys(right).length &&
    Object.keys(left).every(
      (k) =>
        Object.prototype.hasOwnProperty.call(right, k) &&
        same(left[k], right[k])
    )
  );
};
const flush = async (f: Fixture) => {
  for (let i = 0; i < 6; i++) await f.flush();
};
const state = (x = 0, y = 0, z = 0): Snapshot => ({ x, y, z });
const settle = (f: Fixture, h: Handle, operation: 'A' | 'R') =>
  operation === 'A' ? f.candidate.settleAccept(h) : f.candidate.settleReject(h);

export const SUPPLEMENTAL_CASES: SupplementalCase[] = [];
const add = (
  id: string,
  scope: string,
  run: SupplementalCase['run'],
  fixture: keyof Factories = 'scalar'
) => SUPPLEMENTAL_CASES.push({ id, scope, run, fixture });

// Literal visible-value traces, independent of any candidate resolver. Outcome
// letters refer to author 1 then author 2; order is settlement order.
const TWO = [
  ['12', 'AA', [2, 2]],
  ['12', 'AR', [2, 1]],
  ['12', 'RA', [2, 2]],
  ['12', 'RR', [2, 0]],
  ['21', 'AA', [2, 2]],
  ['21', 'AR', [1, 1]],
  ['21', 'RA', [2, 2]],
  ['21', 'RR', [1, 0]],
] as const;
const THREE_REJECT = [
  ['123', [3, 3, 0]],
  ['132', [3, 2, 0]],
  ['213', [3, 3, 0]],
  ['231', [3, 1, 0]],
  ['312', [2, 2, 0]],
  ['321', [2, 1, 0]],
] as const;
for (const [order, outcomes, expected] of TWO)
  add(
    `S11/${order}/${outcomes}`,
    'successful scalar settlement, not refusal safety',
    async (f, c) => {
      const handles: Handle[] = [];
      for (const value of [1, 2]) {
        handles.push(f.candidate.beginContribution(() => f.write('x', value)));
        await flush(f);
        c.equal(
          f.candidate.readVisible(),
          state(value),
          `writer ${value} visible`
        );
      }
      const pending = new Set([0, 1]);
      for (const [step, digit] of [...order].entries()) {
        const index = Number(digit) - 1;
        const result = settle(f, handles[index], outcomes[index] as 'A' | 'R');
        c.note({ author: index + 1, operation: outcomes[index], result });
        c.requireSuccess(result, `author ${index + 1} settles successfully`);
        pending.delete(index);
        await flush(f);
        c.equal(
          f.candidate.readVisible(),
          state(expected[step]),
          `visible after step ${step + 1}`
        );
        handles.forEach((h, i) =>
          c.equal(
            f.hasPendingAuthority(h),
            pending.has(i),
            `native pending membership of author ${i + 1}`
          )
        );
      }
    }
  );
for (const [order, expected] of THREE_REJECT)
  add(
    `S12/reject/${order}`,
    'three-writer rejection ordering; no claim about mixed outcomes',
    async (f, c) => {
      const handles: Handle[] = [];
      for (const value of [1, 2, 3]) {
        handles.push(f.candidate.beginContribution(() => f.write('x', value)));
        await flush(f);
      }
      c.equal(
        f.candidate.readVisible(),
        state(3),
        'three pending writers visible'
      );
      const pending = new Set([0, 1, 2]);
      for (const [step, digit] of [...order].entries()) {
        const index = Number(digit) - 1;
        const result = f.candidate.settleReject(handles[index]);
        c.note({ author: index + 1, result });
        c.requireSuccess(result, 'surgical rejection succeeds');
        pending.delete(index);
        await flush(f);
        c.equal(
          f.candidate.readVisible(),
          state(expected[step]),
          `visible after rejection ${step + 1}`
        );
        handles.forEach((h, i) =>
          c.equal(
            f.hasPendingAuthority(h),
            pending.has(i),
            `native pending membership of author ${i + 1}`
          )
        );
      }
    }
  );
for (const [id, index, op, expected] of [
  ['S06', 1, 'R', 3],
  ['S08', 0, 'A', 3],
  ['S09', 1, 'A', 3],
] as const)
  add(id, 'three-writer single settlement', async (f, c) => {
    const handles: Handle[] = [];
    for (const value of [1, 2, 3]) {
      handles.push(f.candidate.beginContribution(() => f.write('x', value)));
      await flush(f);
    }
    c.requireSuccess(
      settle(f, handles[index], op),
      'requested successful settlement'
    );
    await flush(f);
    c.equal(
      f.candidate.readVisible(),
      state(expected),
      'newest author still visible'
    );
    handles.forEach((h, i) =>
      c.equal(f.hasPendingAuthority(h), i !== index, `pending author ${i + 1}`)
    );
  });
for (const operation of ['A', 'R'] as const) {
  add(
    `S02/ordinary/${operation}`,
    'later ordinary write survives older settlement',
    async (f, c) => {
      const p = f.candidate.beginContribution(() => f.write('x', 1));
      await flush(f);
      f.write('x', 9);
      await flush(f);
      c.requireSuccess(settle(f, p, operation), 'older settlement succeeds');
      await flush(f);
      c.equal(f.candidate.readVisible(), state(9), 'ordinary write preserved');
      c.equal(f.hasPendingAuthority(p), false, 'old handle no longer pending');
    }
  );
  add(
    `S13/local-frontier/${operation}`,
    'two pending writers then ordinary committed newer write',
    async (f, c) => {
      const p = f.candidate.beginContribution(() => f.write('x', 1));
      await flush(f);
      const q = f.candidate.beginContribution(() => f.write('x', 2));
      await flush(f);
      f.write('x', 9);
      await flush(f);
      for (const h of [p, q]) {
        c.requireSuccess(settle(f, h, operation), 'older settlement succeeds');
        await flush(f);
        c.equal(
          f.candidate.readVisible(),
          state(9),
          'newer ordinary truth preserved'
        );
      }
    }
  );
  add(
    `S14/confirmed-newer/${operation}`,
    'newer authored contribution accepted before settling older',
    async (f, c) => {
      const p = f.candidate.beginContribution(() => f.write('x', 1));
      await flush(f);
      const q = f.candidate.beginContribution(() => f.write('x', 2));
      await flush(f);
      c.requireSuccess(f.candidate.settleAccept(q), 'newer accepted');
      await flush(f);
      c.equal(
        f.candidate.readVisible(),
        state(2),
        'newer acceptance intermediate'
      );
      c.equal(f.hasPendingAuthority(p), true, 'older remains pending');
      c.requireSuccess(settle(f, p, operation), 'older settlement succeeds');
      await flush(f);
      c.equal(
        f.candidate.readVisible(),
        state(2),
        'confirmation did not reorder authorship'
      );
    }
  );
}

add(
  'S03/refusal-authority',
  'conditional refusal safety; never surgical conformance',
  async (f, c) => {
    const p = f.candidate.beginContribution(() => {
      f.write('x', 1);
      f.write('y', 1);
    });
    await flush(f);
    const q = f.candidate.beginContribution(() => {
      f.write('y', 2);
      f.write('z', 2);
    });
    await flush(f);
    const before = f.candidate.readVisible(),
      confirmed = f.confirmedCount();
    const seen: Snapshot[] = [],
      off = f.candidate.observeVisible((s) => seen.push(structuredClone(s)));
    try {
      const result = f.candidate.settleReject(p);
      c.note(result);
      if (result.status !== 'refused')
        throw new NotExercised(
          'Native operation did not refuse; this run did not exercise refusal safety. Surgical cases assess its successful path separately.'
        );
      await flush(f);
      c.equal(
        f.candidate.readVisible(),
        before,
        'refusal preserves every scalar'
      );
      c.equal(
        f.hasPendingAuthority(p),
        true,
        'refused handle retains actual pending ID'
      );
      c.equal(
        f.hasPendingAuthority(q),
        true,
        'newer handle retains its own authority'
      );
      c.equal(
        f.confirmedCount(),
        confirmed,
        'refusal creates no confirmed record'
      );
      c.equal(seen, [], 'refusal publishes no owner snapshot');
    } finally {
      off();
    }
  }
);

for (const first of ['A', 'R'] as const)
  for (const second of ['A', 'R'] as const)
    add(
      `terminal/${first}${second}`,
      'non-mutation only; no inferred terminal disposition',
      async (f, c) => {
        const p = f.candidate.beginContribution(() => {
          f.write('x', 1);
          f.write('y', 2);
        });
        await flush(f);
        c.requireSuccess(settle(f, p, first), 'first settlement succeeds');
        await flush(f);
        c.equal(
          f.candidate.readVisible(),
          first === 'A' ? state(1, 2) : state(),
          'first settlement state'
        );
        c.equal(
          f.hasPendingAuthority(p),
          false,
          'first settlement releases native pending membership'
        );
        f.write('x', 9);
        f.write('y', 8);
        f.write('z', 7);
        await flush(f);
        const seen: Snapshot[] = [],
          off = f.candidate.observeVisible((s) =>
            seen.push(structuredClone(s))
          );
        try {
          c.note({ secondResult: settle(f, p, second) });
          await flush(f);
          c.equal(
            f.candidate.readVisible(),
            state(9, 8, 7),
            'later sentinel survives duplicate/opposite call'
          );
          c.equal(
            f.hasPendingAuthority(p),
            false,
            'terminal attempt does not restore pending authority'
          );
          c.equal(seen, [], 'terminal attempt produces no owner publication');
        } finally {
          off();
        }
      }
    );
add(
  'terminal/disposition-reader',
  'capability evidence, not fabricated terminal state',
  async (f, c) => {
    const p = f.candidate.beginContribution(() => f.write('x', 1));
    await flush(f);
    c.requireSuccess(f.candidate.settleReject(p), 'first rejection succeeds');
    c.note(f.candidate.readSettlementState(p));
  }
);

for (const recover of [false, true])
  add(
    recover ? 'F10/occupied-retry' : 'F09/unchanged-conflict',
    'failed-settlement authority, state and retry; real occupied-key fixture',
    async (f, c) => {
      if (!f.prepareConflict || !f.resolveConflict)
        throw new UnsupportedSemantic('No native occupied-key refusal fixture');
      const p = await f.prepareConflict();
      await flush(f);
      const before = structuredClone(f.candidate.readVisible()),
        confirmed = f.confirmedCount();
      const seen: Snapshot[] = [],
        off = f.candidate.observeVisible((s) => seen.push(structuredClone(s)));
      try {
        const first = f.candidate.settleReject(p);
        c.note({ first });
        if (first.status !== 'refused')
          throw new NotExercised(
            'Occupied-key setup did not produce native refusal'
          );
        await flush(f);
        c.equal(
          f.candidate.readVisible(),
          before,
          'failed rejection preserves all state'
        );
        c.equal(
          f.hasPendingAuthority(p),
          true,
          'failed rejection preserves this pending ID'
        );
        c.equal(
          f.confirmedCount(),
          confirmed,
          'failed rejection creates no confirmed record'
        );
        c.equal(seen, [], 'O04: failed rejection publishes nothing');
        if (recover) {
          await f.resolveConflict();
          await flush(f);
          seen.length = 0;
        }
        const retry = f.candidate.settleReject(p);
        c.note({ retry });
        await flush(f);
        if (recover) {
          c.equal(
            retry.status,
            'settled',
            'retry after removing conflict succeeds'
          );
          c.equal(
            f.candidate.readVisible(),
            { ...state(), rows: [{ id: 'A', value: 0 }] },
            'successful retry restores original lifetime value and scalar'
          );
          c.equal(
            f.hasPendingAuthority(p),
            false,
            'successful retry releases pending membership'
          );
        } else {
          c.equal(
            retry.status,
            'refused',
            'unchanged conflict cannot masquerade as success'
          );
          c.equal(
            f.candidate.readVisible(),
            before,
            'retry preserves all state'
          );
          c.equal(
            f.hasPendingAuthority(p),
            true,
            'retry retains same pending ID'
          );
          c.equal(
            f.confirmedCount(),
            confirmed,
            'retry creates no confirmed record'
          );
          c.equal(seen, [], 'retry publishes nothing');
        }
      } finally {
        off();
      }
    },
    'occupied'
  );

add(
  'observer/control-disposal',
  'actual callback delivery and disposal control',
  async (f, c) => {
    const seen: Snapshot[] = [],
      off = f.candidate.observeVisible((s) => seen.push(structuredClone(s)));
    try {
      c.equal(seen, [], 'subscription synthesizes no initial callback');
      f.write('x', 4);
      await flush(f);
      c.check(
        seen.length > 0,
        'real authored write delivers an owner callback'
      );
      c.equal(seen.at(-1), state(4), 'callback reads actual visible state');
      off();
      seen.length = 0;
      f.write('x', 5);
      await flush(f);
      c.equal(seen, [], 'disposed observer receives no callbacks');
    } finally {
      off();
    }
  }
);
for (const op of ['A', 'R'] as const)
  add(
    op === 'A' ? 'O01/multifield-accept' : 'O02/multifield-reject',
    'coherence at native owner publication boundary',
    async (f, c) => {
      const p = f.candidate.beginContribution(() => {
        f.write('x', 1);
        f.write('y', 2);
      });
      await flush(f);
      const seen: Snapshot[] = [],
        off = f.candidate.observeVisible((s) => seen.push(structuredClone(s)));
      try {
        c.requireSuccess(settle(f, p, op), 'successful multi-field settlement');
        await flush(f);
        const expected = op === 'A' ? state(1, 2) : state();
        c.equal(f.candidate.readVisible(), expected, 'settlement final state');
        seen.forEach((s, i) =>
          c.equal(s, expected, `callback ${i} is coherent`)
        );
        if (op === 'R')
          c.check(seen.length > 0, 'changed visible truth is observed');
        c.note({ snapshots: seen });
      } finally {
        off();
      }
    }
  );
add(
  'O05/superseded-accept',
  'native observer never sees an old contribution resurrect',
  async (f, c) => {
    const p = f.candidate.beginContribution(() => {
      f.write('x', 1);
      f.write('y', 2);
    });
    await flush(f);
    f.write('x', 9);
    await flush(f);
    const seen: Snapshot[] = [],
      off = f.candidate.observeVisible((s) => seen.push(structuredClone(s)));
    try {
      c.requireSuccess(
        f.candidate.settleAccept(p),
        'superseded acceptance succeeds'
      );
      await flush(f);
      c.equal(
        f.candidate.readVisible(),
        state(9, 2),
        'newer truth survives acceptance'
      );
      seen.forEach((s, i) =>
        c.equal(s, state(9, 2), `callback ${i} preserves newer truth`)
      );
      c.note({ snapshots: seen });
    } finally {
      off();
    }
  }
);

export async function runSupplemental(
  factories: Factories,
  cases = SUPPLEMENTAL_CASES
): Promise<Evidence[]> {
  const evidence: Evidence[] = [];
  for (const test of cases) {
    const row: Evidence = {
      id: test.id,
      scope: test.scope,
      status: 'error',
      assertions: [],
      trace: [],
    };
    let fixture: Fixture | undefined;
    const context: Context = {
      check(ok, label, detail) {
        row.assertions.push({
          label,
          status: ok ? 'held' : 'violated',
          detail,
        });
      },
      equal(actual, expected, label) {
        context.check(
          same(actual, expected),
          label,
          same(actual, expected)
            ? undefined
            : JSON.stringify({ actual, expected })
        );
      },
      requireSuccess(result, label) {
        context.equal(result.status, 'settled', label);
        if (result.status !== 'settled')
          throw new FailedPrecondition(
            'Successful-settlement obligation not met; refusal is not surgical conformance.'
          );
      },
      note(value) {
        row.trace.push(value);
      },
    };
    try {
      const factory = factories[test.fixture ?? 'scalar'];
      if (!factory) throw new UnsupportedSemantic(`No ${test.fixture} fixture`);
      // Constructors, including ones throwing UnsupportedSemantic, are errors.
      try {
        fixture = await factory();
      } catch (error) {
        throw new Error(`Construction failed: ${String(error)}`);
      }
      await test.run(fixture, context);
      if (!row.assertions.length)
        row.assertions.push({
          label: 'case made no assertion',
          status: 'error',
        });
    } catch (error) {
      if (!(error instanceof FailedPrecondition))
        row.assertions.push({
          label: 'execution',
          status:
            error instanceof UnsupportedSemantic
              ? 'unsupported'
              : error instanceof NotExercised
              ? 'not-exercised'
              : 'error',
          detail: String(error),
        });
    } finally {
      if (fixture)
        try {
          fixture.dispose();
        } catch (error) {
          row.assertions.push({
            label: 'disposal',
            status: 'error',
            detail: String(error),
          });
        }
    }
    row.status =
      (
        ['error', 'violated', 'unsupported', 'not-exercised', 'held'] as const
      ).find((status) => row.assertions.some((a) => a.status === status)) ??
      'error';
    evidence.push(row);
  }
  return evidence;
}
export const supplementalExitCode = (rows: Evidence[]) =>
  rows.length && rows.every((row) => row.status === 'held') ? 0 : 1;
