/**
 * OWNER-SCOPE-0 — what does an absent `ownerId` mean?
 *
 * Before repairing the journal's cross-tree defect (JOURNAL-LIVE-0 falsifier 1),
 * establish for every S2-relevant write path whether `ownerId` is:
 *
 *   A. always present
 *   B. sometimes absent, but another trustworthy tree namespace exists
 *   C. sometimes absent with no trustworthy ownership evidence
 *
 * ⚠️ The repair rule depends on the answer. `restoration.ts:2624` already warns
 * that "an owner-filtered observer is blind to every" write arriving with
 * `ownerId: undefined`, so a naive filter would trade a cross-tree bug for a
 * missing-evidence bug.
 */
import { writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { restoration } from '../../../enhancers/restoration/restoration';
import { transactions } from '../../../enhancers/transactions/transactions';
import { external } from '../../external';
import { entityMap } from '../../markers/entity-map';
import { getPathNotifier } from '../../path-notifier';
import { signalTree } from '../../signal-tree';
import type { WriteMetadata } from '../../mutation-types';

type Row = { id: string; name: string };

interface Seen {
  path: string;
  origin?: string;
  participation?: string;
  ownerId?: number;
  hasOwner: boolean;
  /** Does this frame carry value evidence, or is it a bare invalidation? */
  carriesValue: boolean;
  before?: unknown;
  after?: unknown;
}

function observe() {
  const seen: Seen[] = [];
  const off = getPathNotifier().subscribe(
    '**',
    (next, prev, path, _op, origin, _s, _pos, meta) => {
      const m = (meta ?? {}) as WriteMetadata;
      seen.push({
        path,
        origin: (origin as string) ?? m.origin,
        participation: m.participation,
        ownerId: m.ownerId,
        hasOwner: typeof m.ownerId === 'number',
        carriesValue: next !== undefined || prev !== undefined,
        before: prev,
        after: next,
      });
    }
  );
  return { seen, off };
}

const settle = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const scalarTree = () =>
  signalTree({ total: 0 } as { total: number }, {
    enhancers: [restoration(), transactions()],
  } as never) as never as {
    $: Record<string, (v?: unknown) => unknown>;
    transaction(fn: () => void): { confirm(): void; rollback(): void };
  };

const rowTree = () =>
  signalTree(
    { rows: entityMap<Row, string>({ selectId: (r) => r.id }) },
    { enhancers: [restoration(), transactions()] } as never
  ) as never as {
    $: { rows: { addOne(r: Row): void; updateOne(id: string, p: Partial<Row>): void; removeOne(id: string): void } };
  };

/** Collected across every case so the verdict is evidence, not impression. */
const report: { case: string; total: number; withOwner: number; unscoped: string[] }[] = [];

async function record(name: string, run: () => void | Promise<void>) {
  const { seen, off } = observe();
  try {
    await run();
    await settle();
  } finally {
    off();
  }
  const unscoped = seen
    .filter((s) => !s.hasOwner)
    .map(
      (s) =>
        `${s.path}${s.origin ? ` (${s.origin})` : ''}` +
        (s.carriesValue ? ' [HAS VALUE]' : ' [no value]')
    );
  report.push({ case: name, total: seen.length, withOwner: seen.length - unscoped.length, unscoped });
  return { seen, unscoped };
}

describe('OWNER-SCOPE-0', () => {
  it('ordinary scalar authored', async () => {
    const t = scalarTree();
    const { seen } = await record('scalar authored', () => t.$['total'](1));
    expect(seen.length).toBeGreaterThan(0);
  });

  it('external scalar realization', async () => {
    const t = scalarTree();
    await record('external scalar', () => external(() => t.$['total'](2)));
  });

  it('transaction-authored', async () => {
    const t = scalarTree();
    await record('transaction authored', () => {
      t.transaction(() => t.$['total'](3)).confirm();
    });
  });

  it('transaction rollback compensation', async () => {
    const t = scalarTree();
    await record('transaction rollback', () => {
      const pending = t.transaction(() => t.$['total'](4));
      pending.rollback();
    });
  });

  it('entityMap add (structural)', async () => {
    const t = rowTree();
    await record('entity add', () => t.$.rows.addOne({ id: 'A', name: 'Alpha' }));
  });

  it('entity field authored', async () => {
    const t = rowTree();
    t.$.rows.addOne({ id: 'A', name: 'Alpha' });
    await settle();
    await record('entity field authored', () => t.$.rows.updateOne('A', { name: 'Beta' }));
  });

  it('entity field external realization', async () => {
    const t = rowTree();
    t.$.rows.addOne({ id: 'A', name: 'Alpha' });
    await settle();
    const { seen } = await record('entity field external', () =>
      external(() => t.$.rows.updateOne('A', { name: 'Server' }))
    );
    writeFileSync('/tmp/owner-scope-leak.json', JSON.stringify(seen, null, 1));
  });

  it('entity remove (structural)', async () => {
    const t = rowTree();
    t.$.rows.addOne({ id: 'A', name: 'Alpha' });
    await settle();
    await record('entity remove', () => t.$.rows.removeOne('A'));
  });

  /**
   * ⚠️ WITHDRAWN — this invariant rested on an unsafe predicate.
   *
   * It classified frames using `next !== undefined || prev !== undefined`, which
   * cannot distinguish "no value payload" from "a payload that is legitimately
   * `undefined`". `undefined` is a valid SignalTree state value, so the shape of
   * before/after proves nothing — the same class of error as treating equality
   * as absence of a semantic transition.
   *
   * OWNER-EVIDENCE-0 searched for a POSITIVE discriminator and found none:
   * `subjectIds`, `positionIds`, `ownerPath` and meta-key presence are identical
   * on owned and unowned frames, and `path === ownerPath` is true for scalar
   * leaves too. See `owner-evidence-0.spec.ts`.
   *
   * Consequence: unowned frames CANNOT be classified as non-evidence, so S2
   * needs a `scopeIntegrity` signal rather than a silent filter.
   */
  it('unowned frames exist and cannot be positively classified', () => {
    const unscoped = report.flatMap((r) => r.unscoped);
    expect(unscoped.length).toBeGreaterThan(0);
  });

  it('VERDICT', () => {
    const lines = report.map(
      (r) =>
        `${r.case.padEnd(26)} ${String(r.withOwner).padStart(2)}/${String(r.total).padStart(2)} owned` +
        (r.unscoped.length ? `  UNSCOPED: ${r.unscoped.join(', ')}` : '')
    );
    const unscopedWithValue = report.flatMap((r) =>
      r.unscoped.filter((u) => u.includes('[HAS VALUE]'))
    );
    const unscopedBare = report.flatMap((r) =>
      r.unscoped.filter((u) => u.includes('[no value]'))
    );
    const outcome = unscopedWithValue.length
      ? `OUTCOME C: ${unscopedWithValue.length} unscoped frame(s) CARRY VALUE -> a filter drops real evidence; scopeIntegrity required`
      : unscopedBare.length
        ? `OUTCOME B: unscoped frames exist (${unscopedBare.length}) but carry NO value -> filtering on ownerId is SAFE for S2`
        : 'OUTCOME A: ownerId always present -> filter trivially safe';
    writeFileSync('/tmp/owner-scope-0.txt', lines.join('\n') + '\n\n' + outcome + '\n');
    expect(report.length).toBeGreaterThan(0);
  });
});
