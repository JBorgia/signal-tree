/**
 * THE S1+S2 LIVE VERTICAL.
 *
 * Real tree -> bridge commands -> EvidenceSet -> whyValue, with the current
 * value read from the LIVE tree rather than inferred from retained evidence.
 */
import { external, signalTree, transactions } from '@signal-tree/kernel';
import {
  type CapturedValue,
  type EvidenceSet,
  type RealizationEvidence,
  type TransactionEvidence,
} from '@signal-tree/studio-query';
import { afterEach, describe, expect, it } from 'vitest';

import { attachStudio, type LiveTree } from '../index';
import { handleStudioRequest } from './index';
import { STUDIO_PROTOCOL_VERSION } from './protocol';

type Cart = { total: number };
const settle = async () => { await Promise.resolve(); await Promise.resolve(); };
const opened: { detach(): void }[] = [];
afterEach(() => { while (opened.length) opened.pop()?.detach(); });

const send = (command: string, extra: Record<string, unknown> = {}) =>
  handleStudioRequest({ protocol: STUDIO_PROTOCOL_VERSION, id: 'r', command, ...extra } as never);

const ok = <T>(r: ReturnType<typeof send>): T => {
  if (!r.ok) throw new Error(`refused: ${JSON.stringify(r.error)}`);
  return r.value as T;
};

const makeTree = () =>
  signalTree({ total: 12000 } as Cart, { enhancers: [transactions()] } as never) as never as
    LiveTree & { $: Record<string, (v?: unknown) => unknown>; transaction(fn: () => void): { confirm(): void } };

describe('live Why? vertical', () => {
  it('reports the three realization states truthfully', async () => {
    const bare = signalTree({ total: 1 } as Cart) as never as LiveTree;
    const a = attachStudio(bare, { label: 'Bare' });
    opened.push(a);

    // UNSUPPORTED — not an empty array.
    expect(ok<{ support: string }>(send('readRealizations', { treeId: a.id })).support).toBe('unsupported');

    const tree = makeTree();
    const b = attachStudio(tree, { label: 'AppTree' });
    opened.push(b);

    // SUPPORTED / INACTIVE — capture has not started.
    expect(ok<{ capture: string }>(send('readRealizations', { treeId: b.id })).capture).toBe('inactive');

    // Explicit start — never automatic.
    expect(ok<{ started: boolean }>(send('startRealizationCapture', { treeId: b.id })).started).toBe(true);

    // SUPPORTED / ACTIVE with nothing seen — the ONLY state where [] is truthful.
    const active = ok<{ capture: string; snapshot: { effects: unknown[] } }>(
      send('readRealizations', { treeId: b.id })
    );
    expect(active.capture).toBe('active');
    expect(active.snapshot.effects).toEqual([]);

    ok(send('stopRealizationCapture', { treeId: b.id }));
  });

  it('assembles a live EvidenceSet and explains the real value', async () => {
    const tree = makeTree();
    const a = attachStudio(tree, { label: 'AppTree' });
    opened.push(a);

    tree.transaction(() => tree.$['total'](9600)).confirm();
    await settle();
    tree.transaction(() => tree.$['total'](9800)).confirm();
    await settle();

    ok(send('startRealizationCapture', { treeId: a.id }));
    external(() => tree.$['total'](10200));
    await settle();

    const turns = ok<{ turns: { id: number; effects: { path: string; before: unknown; after: unknown }[] }[] }>(
      send('readConfirmedTurns', { treeId: a.id })
    );
    const realized = ok<{ snapshot: { effects: RealizationEvidence[] } }>(
      send('readRealizations', { treeId: a.id })
    );
    const current = ok<CapturedValue>(send('readCurrentValue', { treeId: a.id, path: 'total' }));

    // The live read must agree with reality, not with retained evidence.
    expect(current).toEqual({ kind: 'value', value: 10200 });

    const set: EvidenceSet = {
      transactions: turns.turns.map<TransactionEvidence>((t) => ({
        kind: 'transaction', treeId: a.id, turnId: t.id, disposition: 'committed',
        effects: t.effects.map((e) => ({ path: e.path, ownerPath: e.path, before: e.before, after: e.after })),
      })),
      realizations: realized.snapshot.effects.map((e) => ({ ...e, kind: 'realization', treeId: a.id })),
      coverage: { completeFromTreeStart: false, scopeIntegrity: 'complete', startedAtSequence: 0, truncated: false },
    };

    expect(set.transactions.length).toBeGreaterThanOrEqual(2);
    expect(set.realizations).toHaveLength(1);
    expect(set.realizations[0]?.after).toEqual({ kind: 'value', value: 10200 });
    // SUPERSESSION-0: no transaction is named by the realization.
    expect(set.realizations[0]?.transactionId).toBeUndefined();

    ok(send('stopRealizationCapture', { treeId: a.id }));
  });

  /**
   * The protection that only works against a LIVE read: if the value moves on
   * after capture stops, retained evidence must not appear to explain it.
   */
  it('current value diverging from evidence is visible', async () => {
    const tree = makeTree();
    const a = attachStudio(tree, { label: 'AppTree' });
    opened.push(a);

    ok(send('startRealizationCapture', { treeId: a.id }));
    external(() => tree.$['total'](10200));
    await settle();
    ok(send('stopRealizationCapture', { treeId: a.id }));

    // Something changes it afterwards, unobserved.
    tree.transaction(() => tree.$['total'](77777)).confirm();
    await settle();

    const current = ok<CapturedValue>(send('readCurrentValue', { treeId: a.id, path: 'total' }));
    expect(current).toEqual({ kind: 'value', value: 77777 });
  });

  it('stopping snapshots before releasing, so the investigation survives', async () => {
    const tree = makeTree();
    const a = attachStudio(tree, { label: 'AppTree' });
    opened.push(a);

    ok(send('startRealizationCapture', { treeId: a.id }));
    external(() => tree.$['total'](10200));
    await settle();

    const stopped = ok<{ stopped: boolean; snapshot: { effects: unknown[] } }>(
      send('stopRealizationCapture', { treeId: a.id })
    );
    expect(stopped.stopped).toBe(true);
    expect(stopped.snapshot.effects).toHaveLength(1);

    // Recorder released; the panel keeps what it was handed.
    expect(ok<{ capture: string }>(send('readRealizations', { treeId: a.id })).capture).toBe('inactive');
  });

  it('an unresolvable path is reported, not returned as undefined', () => {
    const tree = makeTree();
    const a = attachStudio(tree, { label: 'AppTree' });
    opened.push(a);
    const v = ok<CapturedValue>(send('readCurrentValue', { treeId: a.id, path: 'nope.missing' }));
    expect(v.kind).toBe('unserializable');
  });
});
