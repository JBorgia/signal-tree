import { expect, it, vi } from 'vitest';
import { peekInternalTransactionRuntime } from './transactions';
import { SignalTreeRollbackError } from '../../lib/types';
import { EntityOrdinaryTopology } from '../../lib/physical/entity-ordinary-topology';
import type { CompletedTopologyUnit } from '../../lib/internals/mutation-capture-runtime';
import { signalTree, entityMap, transactions } from '../../index';
import { getMutationCaptureRuntime } from '../../lib/internals/mutation-capture-runtime';
import { withWriteContext } from '../../lib/write-context';
it('admits completed outer order before entity capture can author foreign order', async () => {
  const t = signalTree(
    { rows: entityMap<{ id: string }, string>() },
    { enhancers: [transactions()] }
  );
  const r = t.$.rows;
  const rows = ['a', 'b', 'c'].map((id) => ({ id }));
  try {
    r.setAll(rows);
    for (let i = 0; i < 30; i++) await Promise.resolve();
    const rt = getMutationCaptureRuntime(t)!;
    let fired = false;
    const release = rt.activateCapture();
    const off = rt.subscribeCommittedEntity!((capture) => {
      if (fired || capture.meta?.participation === 'realized') return;
      fired = true;
      withWriteContext({ intent: 'system', participation: 'realized' }, () =>
        r.setAll([rows[1], rows[2], rows[0]])
      );
    });
    let p: ReturnType<typeof t.transact>;
    try {
      p = t.transact(() => {
        r.setAll([...rows].reverse());
        r.setAll([rows[0], rows[2], rows[1]]);
      });
    } finally {
      off();
      release();
    }
    expect(fired).toBe(true);
    expect(() => p.rollback()).toThrow(/ordering conflict/i);
    expect(r.ids()).toEqual(['a', 'c', 'b']);
    expect(() => p.inspect()).not.toThrow();
    p.confirm();
  } finally {
    t.destroy();
  }
});

it('retains completed ordinary and physical order for useful recovery when rich capture throws', async () => {
  const t = signalTree(
    { rows: entityMap<{ id: string }, string>() },
    { enhancers: [transactions()] }
  );
  try {
    const r = t.$.rows;
    const rows = ['a', 'b', 'c'].map((id) => ({ id }));
    r.setAll(rows);
    for (let i = 0; i < 30; i++) await Promise.resolve();
    const held = r.byIdOrFail('b');
    const runtime = getMutationCaptureRuntime(t)!;
    const original = runtime.publishCommittedEntity!;
    let abortBlocked = false;
    const sentinel = new Error('controlled rich capture failure');
    const units: CompletedTopologyUnit[] = [];
    const publication = vi
      .spyOn(runtime, 'publishCommittedEntity')
      .mockImplementation((capture) => {
        if (capture.topologyUnit) units.push(capture.topologyUnit);
        if (units.length === 2) {
          abortBlocked = true;
          throw sentinel;
        }
        original(capture);
      });
    const originalInstall = EntityOrdinaryTopology.prototype.prepareInstall;
    const refusal = vi
      .spyOn(EntityOrdinaryTopology.prototype, 'prepareInstall')
      .mockImplementation(function (
        this: EntityOrdinaryTopology<string>,
        ordinary,
        physical
      ) {
        const prepared = originalInstall.call(this, ordinary, physical);
        if (abortBlocked)
          throw new Error('controlled inverse preparation refusal');
        return prepared;
      });
    let failure: unknown;
    try {
      t.transact(() => {
        r.addOne({ id: 'w' });
        r.setAll([{ id: 'c' }, { id: 'b' }, { id: 'a' }, { id: 'w' }]);
      });
    } catch (error) {
      failure = error;
    } finally {
      publication.mockRestore();
      refusal.mockRestore();
    }
    expect(failure).toBeInstanceOf(SignalTreeRollbackError);
    if (!(failure instanceof SignalTreeRollbackError)) throw failure;
    expect(failure.recovery?.callbackError).toBe(sentinel);
    const pending = failure.recovery!.transaction;
    expect(r.ids()).toEqual(['c', 'b', 'a', 'w']);
    expect(units).toHaveLength(2);
    expect(units[0].physical.after).toBe(units[1].physical.before);
    expect(units[0].ordinary.after).toBe(units[1].ordinary.before);
    expect(units[1].order?.ordinaryEndpoints?.after).toEqual(
      units[1].order?.afterSubjects
    );
    expect(pending.inspect().changes.length).toBeGreaterThan(0);
    pending.rollback();
    expect(r.ids()).toEqual(['a', 'b', 'c']);
    expect(r.byIdOrFail('b')).toBe(held);
    expect(peekInternalTransactionRuntime(t)!.getPendingTurnCount()).toBe(0);
    pending.rollback();
    const next = t.transact(() =>
      r.prependMany([{ id: 'c' }], { mode: 'overwrite' })
    );
    next.rollback();
    expect(r.ids()).toEqual(['a', 'b', 'c']);
  } finally {
    t.destroy();
  }
});
