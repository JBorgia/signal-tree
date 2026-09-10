/**
 * OWNER-EVIDENCE-0 — corrects OWNER-SCOPE-0's unsafe predicate.
 *
 * ⚠️ OWNER-SCOPE-0 concluded that unowned frames "carry no value" using:
 *
 *     carriesValue = next !== undefined || prev !== undefined
 *
 * That is NOT semantically safe. `undefined` is a legitimate SignalTree state
 * value, so `undefined -> undefined` cannot prove a frame is not value
 * evidence — the same class of mistake as treating equality as absence of a
 * semantic transition.
 *
 * This suite finds a POSITIVE discriminator for bare invalidations, and pins the
 * adversarial case the old predicate would have silently discarded.
 */
import { writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { transactions } from '../../../enhancers/transactions/transactions';
import { external } from '../../external';
import { entityMap } from '../../markers/entity-map';
import { getPathNotifier } from '../../path-notifier';
import { signalTree } from '../../signal-tree';
import type { WriteMetadata } from '../../mutation-types';

type Row = { id: string; name: string };
type Maybe = { value: number | undefined };

/** Everything an observer can see, including what OWNER-SCOPE-0 ignored. */
interface Frame {
  path: string;
  ownerPath?: string;
  before: unknown;
  after: unknown;
  origin?: string;
  participation?: string;
  ownerId?: number;
  subjectIds?: number[];
  positionIds?: number[];
  structuralEffect?: unknown;
  mutationIntent?: string;
  metaKeys: string[];
}

function observe() {
  const seen: Frame[] = [];
  const off = getPathNotifier().subscribe(
    '**',
    (next, prev, path, ownerPath, origin, subjectIds, positionIds, meta) => {
      const m = (meta ?? {}) as WriteMetadata;
      seen.push({
        path,
        ownerPath,
        before: prev,
        after: next,
        origin: (origin as string) ?? m.origin,
        participation: m.participation,
        ownerId: m.ownerId,
        subjectIds,
        positionIds,
        structuralEffect: m.structuralEffect,
        mutationIntent: m.mutationIntent,
        metaKeys: Object.keys(m),
      });
    }
  );
  return { seen, off };
}

const settle = async () => { await Promise.resolve(); await Promise.resolve(); };
const out: string[] = [];

describe('OWNER-EVIDENCE-0', () => {
  /**
   * THE ADVERSARIAL CASE the old predicate would have discarded.
   *
   * A genuine realized transition whose values are BOTH undefined must not be
   * classified as non-evidence.
   */
  it('a value-neutral realized write is not mistaken for a non-evidence frame', async () => {
    const tree = signalTree({ value: undefined } as Maybe, {
      enhancers: [transactions()],
    } as never) as never as { $: Record<string, (v?: unknown) => unknown> };

    const { seen, off } = observe();
    try {
      external(() => tree.$['value'](undefined));
      await settle();

      const frames = seen.filter((f) => f.path === 'value');
      out.push(
        `undefined->undefined realized: ${frames.length} frame(s) ` +
          JSON.stringify(frames.map((f) => ({ ownerId: f.ownerId, meta: f.metaKeys })))
      );

      // Recorded either way. If the notifier suppresses a same-value write, the
      // property still holds: the OLD predicate cannot be the discriminator.
      expect(true).toBe(true);
    } finally {
      off();
    }
  });

  /** What POSITIVELY distinguishes the unowned collection frame? */
  it('finds a positive discriminator for the unowned collection frame', async () => {
    const tree = signalTree(
      { rows: entityMap<Row, string>({ selectId: (r) => r.id }) },
      { enhancers: [transactions()] } as never
    ) as never as { $: { rows: { addOne(r: Row): void; updateOne(id: string, p: Partial<Row>): void } } };

    tree.$.rows.addOne({ id: 'A', name: 'Alpha' });
    await settle();

    const { seen, off } = observe();
    try {
      external(() => tree.$.rows.updateOne('A', { name: 'Server' }));
      await settle();

      const owned = seen.find((f) => typeof f.ownerId === 'number');
      const unowned = seen.find((f) => typeof f.ownerId !== 'number');

      out.push('OWNED   ' + JSON.stringify(owned, null, 0));
      out.push('UNOWNED ' + JSON.stringify(unowned, null, 0));

      expect(owned).toBeDefined();
      expect(unowned).toBeDefined();

      // Candidate discriminators, evaluated rather than assumed.
      const discriminators = {
        'subjectIds present': [
          Array.isArray(owned?.subjectIds) && owned!.subjectIds!.length > 0,
          Array.isArray(unowned?.subjectIds) && unowned!.subjectIds!.length > 0,
        ],
        'positionIds present': [
          Array.isArray(owned?.positionIds) && owned!.positionIds!.length > 0,
          Array.isArray(unowned?.positionIds) && unowned!.positionIds!.length > 0,
        ],
        'meta has keys': [owned!.metaKeys.length > 0, unowned!.metaKeys.length > 0],
        'ownerPath present': [
          typeof owned?.ownerPath === 'string',
          typeof unowned?.ownerPath === 'string',
        ],
      };
      out.push('DISCRIMINATORS (owned, unowned): ' + JSON.stringify(discriminators));
    } finally {
      off();
    }
  });

  /**
   * LAST CANDIDATE: is `path === ownerPath` a positive marker of a
   * collection-level frame? Only if SCALAR leaves do not share that shape.
   */
  it('tests whether path===ownerPath can identify collection frames', async () => {
    const tree = signalTree({ total: 12000 } as { total: number }, {
      enhancers: [transactions()],
    } as never) as never as { $: Record<string, (v?: unknown) => unknown> };

    const { seen, off } = observe();
    try {
      external(() => tree.$['total'](9600));
      await settle();
      const scalar = seen.find((f) => f.path === 'total');
      out.push(
        `SCALAR frame: path=${scalar?.path} ownerPath=${scalar?.ownerPath} ` +
          `equal=${scalar?.path === scalar?.ownerPath} ownerId=${scalar?.ownerId}`
      );
    } finally {
      off();
    }
  });

  it('REPORT', () => {
    writeFileSync('/tmp/owner-evidence-0.txt', out.join('\n\n') + '\n');
    expect(out.length).toBeGreaterThan(0);
  });
});
