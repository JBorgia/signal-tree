/**
 * SUPERSESSION-0 — see docs/research/studio-value-0/SUPERSESSION-0.md
 *
 * Measures whether EXISTING kernel evidence links a realization to the authored
 * consequence it superseded. Outcomes were frozen before this ran.
 */
import { describe, expect, it } from 'vitest';

import { restoration } from '../../../enhancers/restoration/restoration';
import { transactions } from '../../../enhancers/transactions/transactions';
import { external } from '../../external';
import { entityMap } from '../../markers/entity-map';
import { getPathNotifier } from '../../path-notifier';
import { signalTree } from '../../signal-tree';
import type { WriteMetadata } from '../../mutation-types';

type Cart = { total: number };
type Row = { id: string; name: string };

interface Observed {
  path: string;
  before: unknown;
  after: unknown;
  origin?: string;
  participation?: string;
  transactionId?: unknown;
  ownerId?: unknown;
}

/** Records everything an observer can see, so nothing is assumed. */
function observe() {
  const seen: Observed[] = [];
  const off = getPathNotifier().subscribe(
    '**',
    (next, prev, path, _ownerPath, origin, _s, _p, meta) => {
      const m = (meta ?? {}) as WriteMetadata;
      seen.push({
        path,
        before: prev,
        after: next,
        origin: (origin as string) ?? m.origin,
        participation: m.participation,
        transactionId: m.transactionId,
        ownerId: m.ownerId,
      });
    }
  );
  return { seen, off };
}

const cart = (total = 12000) =>
  signalTree({ total } as Cart, {
    enhancers: [restoration(), transactions()],
  } as never) as never as {
    $: Record<string, (v?: unknown) => unknown>;
    transaction(fn: () => void): { confirm(): void };
  };

const settle = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe('SUPERSESSION-0', () => {
  it('case 1 — plain scalar: realization is classified but carries no referent', async () => {
    const tree = cart();
    const { seen, off } = observe();
    try {
      tree.$['total'](9600);
      await settle();
      external(() => tree.$['total'](10200));
      await settle();

      const realized = seen.filter((s) => s.participation === 'realized');
      expect(realized.length).toBeGreaterThan(0);

      const r = realized.at(-1)!;
      expect(r.origin).toBe('external');
      // THE FINDING: no referent to the authored consequence it replaced.
      expect(r.transactionId).toBeUndefined();
      // Only local succession is available: what was there immediately before.
      expect(r.before).toBe(9600);
      expect(r.after).toBe(10200);
    } finally {
      off();
    }
  });

  it('case 2 — transaction-authored, then realized: no back-reference to the turn', async () => {
    const tree = cart();
    const { seen, off } = observe();
    try {
      tree.transaction(() => tree.$['total'](9600)).confirm();
      await settle();
      external(() => tree.$['total'](10200));
      await settle();

      const authored = seen.find((s) => s.transactionId !== undefined);
      expect(authored).toBeDefined();

      const realized = seen.filter((s) => s.participation === 'realized').at(-1)!;
      // The realization does NOT carry the transaction it superseded.
      expect(realized.transactionId).toBeUndefined();
      expect(realized.transactionId).not.toBe(authored?.transactionId);
    } finally {
      off();
    }
  });

  /**
   * CASE 4 — THE DECIDING CASE.
   *
   *   T31 authored L = 9600
   *   T32 authored L = 9800
   *   R44 realized L = 10200
   *
   * The truthful value-level predecessor is 9800. Anything that links the
   * realization to T31 is inventing causation from interestingness.
   */
  it('case 4 — intervening authored write: predecessor is the LAST value, not the interesting one', async () => {
    const tree = cart();
    const { seen, off } = observe();
    try {
      tree.transaction(() => tree.$['total'](9600)).confirm();
      await settle();
      tree.transaction(() => tree.$['total'](9800)).confirm();
      await settle();
      external(() => tree.$['total'](10200));
      await settle();

      const realized = seen.filter((s) => s.participation === 'realized').at(-1)!;

      // Local succession is truthful and available.
      expect(realized.before).toBe(9800);
      expect(realized.after).toBe(10200);

      // No evidence names EITHER transaction, so "the server corrected T31"
      // is unsupported — and so is "corrected T32".
      expect(realized.transactionId).toBeUndefined();
    } finally {
      off();
    }
  });

  it('case 5 — same-value realization is still classified as realized', async () => {
    const tree = cart();
    const { seen, off } = observe();
    try {
      tree.$['total'](9600);
      await settle();
      external(() => tree.$['total'](9600));
      await settle();

      // May coalesce to no-op; if it surfaces, it must not read as authored.
      for (const s of seen.filter((x) => x.after === 9600).slice(1)) {
        expect(s.participation === 'realized' || s.participation === undefined).toBe(true);
      }
    } finally {
      off();
    }
  });

  /**
   * CASE 3 — FINDING, not a failure. An external `updateOne` addresses the ROW
   * (`rows.A`) with whole-object before/after, while an AUTHORED entity-field
   * write addresses the FIELD (`rows.A.name`, per pending-rollback's own doc).
   *
   * Field-level supersession is therefore DERIVABLE by diffing the row, but it
   * is not the captured address. S2 must not present a derived field diff as if
   * the kernel addressed the field.
   */
  it('case 3 — entity realization addresses the ROW; field change is derivable', async () => {
    const tree = signalTree(
      { rows: entityMap<Row, string>({ selectId: (r) => r.id }) },
      { enhancers: [restoration(), transactions()] } as never
    ) as never as { $: { rows: { addOne(r: Row): void; updateOne(id: string, p: Partial<Row>): void } } };

    tree.$.rows.addOne({ id: 'A', name: 'Alpha' });
    await settle();

    const { seen, off } = observe();
    try {
      external(() => tree.$.rows.updateOne('A', { name: 'Server' }));
      await settle();

      const realized = seen.filter((s) => s.participation === 'realized');
      expect(realized.length).toBeGreaterThan(0);

      const row = realized.find((r) => r.path === 'rows.A');
      expect(row).toBeDefined();
      // The address is the ROW, not the field.
      expect(realized.some((r) => r.path.includes('.name'))).toBe(false);
      // The field change is recoverable only by diffing whole objects.
      expect((row?.before as Row).name).toBe('Alpha');
      expect((row?.after as Row).name).toBe('Server');
    } finally {
      off();
    }
  });

  it('case 7 — two trees: ownerId is present to tell realizations apart', async () => {
    const a = cart();
    const b = cart();
    const { seen, off } = observe();
    try {
      external(() => a.$['total'](111));
      external(() => b.$['total'](222));
      await settle();

      const realized = seen.filter((s) => s.participation === 'realized');
      const owners = new Set(realized.map((s) => s.ownerId));
      // Two trees must be distinguishable by the evidence itself.
      expect(owners.size).toBeGreaterThan(1);
    } finally {
      off();
    }
  });
});
