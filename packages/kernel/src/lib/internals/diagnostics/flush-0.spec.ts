/**
 * FLUSH-0 — see docs/research/studio-value-0/FLUSH-0.md
 *
 * Does observing S2's semantic fact require a flush boundary, or is flush
 * merely how a dormant journal packaged records?
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
import { createDiagnosticJournal } from './diagnostic-journal';

type Cart = { total: number; a: number; b: number; c: number };
type Row = { id: string; name: string };

interface Frame {
  path: string;
  ownerPath?: string;
  before: unknown;
  after: unknown;
  origin?: string;
  participation?: string;
  ownerId?: number;
  transactionId?: unknown;
}

function observe() {
  const seen: Frame[] = [];
  const off = getPathNotifier().subscribe(
    '**',
    (next, prev, path, ownerPath, origin, _s, _p, meta) => {
      const m = (meta ?? {}) as WriteMetadata;
      seen.push({
        path,
        ownerPath,
        before: prev,
        after: next,
        origin: (origin as string) ?? m.origin,
        participation: m.participation,
        ownerId: m.ownerId,
        transactionId: m.transactionId,
      });
    }
  );
  return { seen, off };
}

const settle = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

/** NO enhancers. */
const bare = () =>
  signalTree({ total: 12000, a: 0, b: 0, c: 0 } as Cart) as never as {
    $: Record<string, (v?: unknown) => unknown>;
  };

/**
 * The MINIMAL composition under which scalar writes are observable at all.
 * Measured: bare and batching() deliver ZERO frames; restoration() alone or
 * transactions() alone deliver. Leaf interception, not flush, is the gate.
 */
const observable = () =>
  signalTree({ total: 12000, a: 0, b: 0, c: 0 } as Cart, {
    enhancers: [transactions()],
  } as never) as never as {
    $: Record<string, (v?: unknown) => unknown>;
  };

const enhanced = () =>
  signalTree({ total: 12000, a: 0, b: 0, c: 0 } as Cart, {
    enhancers: [restoration(), transactions()],
  } as never) as never as {
    $: Record<string, (v?: unknown) => unknown>;
    transaction(fn: () => void): { confirm(): void };
  };

const findings: string[] = [];
const note = (s: string) => findings.push(s);

describe('FLUSH-0', () => {
  /** CASE 1 — the three-way split. Delivery, buffering and materialization. */
  it('case 1 — bare tree delivers NOTHING; observation is the gate, not flush', async () => {
    const tree = bare();
    const { seen, off } = observe();
    const journal = createDiagnosticJournal(tree);
    try {
      tree.$['total'](9600);
      await settle();

      const delivered = seen.find((f) => f.path === 'total');
      const materialized = journal.turns().length;

      note(`case 1  A delivered=${delivered ? 'YES' : 'NO'}  C turns=${materialized}`);

      // THE FINDING: a bare tree delivers NO scalar frame at all. The flush
      // question is moot here — there is nothing to package.
      expect(delivered).toBeUndefined();
      expect(materialized).toBe(0);
    } finally {
      journal.dispose();
      off();
    }
  });

  /** CASE 2 — does raw delivery carry S2's whole required fact on a bare tree? */
  it('case 2 — on the minimal observable tree, raw delivery carries the WHOLE fact', async () => {
    const tree = observable();
    const { seen, off } = observe();
    try {
      external(() => tree.$['total'](10200));
      await settle();

      const r = seen.find((f) => f.path === 'total');
      expect(r).toBeDefined();

      const complete =
        typeof r?.path === 'string' &&
        typeof r?.ownerPath === 'string' &&
        r?.before === 12000 &&
        r?.after === 10200 &&
        r?.origin === 'external' &&
        r?.participation === 'realized' &&
        typeof r?.ownerId === 'number';

      note(
        `case 2  complete=${complete ? 'YES' : 'NO'}  ` +
          `origin=${r?.origin} participation=${r?.participation} ownerId=${r?.ownerId}`
      );
      expect(complete).toBe(true);
    } finally {
      off();
    }
  });

  /** CASE 3 — is there a shipped fact grouping synchronous realized writes? */
  it('case 3 — no shipped fact groups synchronous realized writes', async () => {
    const tree = observable();
    const { seen, off } = observe();
    try {
      external(() => {
        tree.$['a'](1);
        tree.$['b'](2);
        tree.$['c'](3);
      });
      await settle();

      const realized = seen.filter((f) => f.participation === 'realized');
      expect(realized.length).toBe(3);

      // Is there ANY shared identifier proving these are one operation?
      const ids = new Set(realized.map((f) => f.transactionId));
      const groupingFact = ids.size === 1 && [...ids][0] !== undefined;

      note(
        `case 3  writes=${realized.length} groupingFact=${groupingFact ? 'YES' : 'NO'} ` +
          `transactionIds=${JSON.stringify([...ids])}`
      );
      // Recorded, not asserted as desirable.
      expect(realized.length).toBe(3);
    } finally {
      off();
    }
  });

  /** CASE 4 — do S1 and S2 sources combine without sharing a container? */
  it('case 4 — S1 turn source and S2 effect source stay separate and combinable', async () => {
    const tree = enhanced();
    const { seen, off } = observe();
    try {
      tree.transaction(() => tree.$['total'](9600)).confirm();
      await settle();
      external(() => tree.$['total'](10200));
      await settle();

      const authored = seen.filter((f) => f.transactionId !== undefined);
      const realized = seen.filter((f) => f.participation === 'realized');

      note(
        `case 4  authoredFrames=${authored.length} realizedFrames=${realized.length} ` +
          `succession=${realized.at(-1)?.before}->${realized.at(-1)?.after}`
      );

      expect(authored.length).toBeGreaterThan(0);
      expect(realized.at(-1)?.before).toBe(9600);
      expect(realized.at(-1)?.after).toBe(10200);
    } finally {
      off();
    }
  });

  /** CASE 6 — entity whole-object realization on a bare tree. */
  it('case 6 — entity realization delivers without a flush driver', async () => {
    const tree = signalTree({
      rows: entityMap<Row, string>({ selectId: (r) => r.id }),
    }) as never as { $: { rows: { addOne(r: Row): void; updateOne(id: string, p: Partial<Row>): void } } };

    tree.$.rows.addOne({ id: 'A', name: 'Alpha' });
    await settle();

    const { seen, off } = observe();
    try {
      external(() => tree.$.rows.updateOne('A', { name: 'Server' }));
      await settle();

      const row = seen.find((f) => f.path === 'rows.A');
      note(`case 6  rowFrame=${row ? 'YES' : 'NO'} participation=${row?.participation}`);
      expect(row).toBeDefined();
      expect(row?.participation).toBe('realized');
    } finally {
      off();
    }
  });

  /** CASE 7 — several writes with no flush between them. */
  it('case 7 — every write is delivered individually without any flush', async () => {
    const tree = observable();
    const { seen, off } = observe();
    try {
      tree.$['a'](1);
      tree.$['b'](2);
      tree.$['c'](3);
      await settle();

      const paths = seen.map((f) => f.path);
      note(`case 7  delivered=${JSON.stringify(paths)}`);
      expect(paths).toEqual(expect.arrayContaining(['a', 'b', 'c']));
    } finally {
      off();
    }
  });

  it('VERDICT', () => {
    writeFileSync('/tmp/flush-0.txt', findings.join('\n') + '\n');
    expect(findings.length).toBeGreaterThan(0);
  });
});
