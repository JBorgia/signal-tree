import { appendFileSync } from 'node:fs';
import { expect, it, vi } from 'vitest';
import { link, signalTree, transactions, type PendingTransaction, type PublicationReceipt } from '../index';
import * as lifecycle from './experimental-publication/lifecycle';
import { RecipientOccurrences } from './experimental-publication/recipient-occurrence';
import { preparePublicationMutations } from './internals/intrinsic-mutation';
const drain = async () => { for (let i = 0; i < 120; i++) await Promise.resolve(); };
const record = (row: unknown) => {
  const sink = process.env.ST_COMPARATOR_BOUNDARY_OUTPUT;
  if (sink) appendFileSync(sink, JSON.stringify(row) + '\n');
};

it('late preparer confirmation does not lose pending destination or duplicate delivery', async () => {
  const tree = signalTree({ pair: { x: 0, y: 0 }, q: 0 }, { enhancers: [transactions()] });
  const sent: { x: number; y: number }[] = [];
  let armed = false, calls = 0;
  let a: PendingTransaction | undefined;
  const order: string[] = [];
  // Private callback-capable preparation seam, enrolled before the actual Link.
  // It changes only authentic owner outcome; no proof/requirement injection.
  const release = preparePublicationMutations(tree.$.pair.x, (_mutation, _input, native) => {
    if (!armed) return undefined;
    expect(native).toBeDefined(); order.push('after-native-before-recipient');
    calls++; armed = false;
    if (!a) throw new Error('missing historical owner');
    a.confirm(); order.push('confirmed');
    return undefined;
  }, () => { /* No completion unit is returned by this preparation seam. */ });
  const c = link(tree.$.pair, { set: value => { sent.push(value); } });
  const tail = preparePublicationMutations(tree.$.pair.x, () => {
    if (calls) order.push('after-recipient');
    return undefined;
  }, () => { /* Preparation-order observation only. */ });
  try {
    expect(release).toBeTypeOf('function'); expect(tail).toBeTypeOf('function');
    const p = tree.transact(() => tree.$.pair.x(7));
    a = tree.transact(() => tree.$.q(1));
    const historical = c.declare({ kind: 'dependent', owners: [p, a] }, () => {
      tree.$(current => ({ ...current, pair: { ...current.pair } }));
    });
    await drain(); expect(sent).toEqual([]);
    const saved = tree.$.pair(), ownerBefore = p.inspect();
    let receipt: PublicationReceipt | undefined, error: unknown;
    armed = true;
    try { receipt = c.declare({ kind: 'dependent', owners: [p] }, () => tree.$.pair.x(7)); }
    catch (caught) { error = caught; }
    await drain(); const before = [...sent], beforeReceipt = receipt?.read();
    const ownerUnchanged = JSON.stringify(p.inspect()) === JSON.stringify(ownerBefore);
    p.confirm(); await drain(); await c.settled(); await drain();
    const final = [...sent], terminal = receipt?.read();
    c.dispose(); tree.$.pair.x(9); await drain();
    record({ case: 'late-confirm', calls, order, before, beforeReceipt, final, terminal,
      historical: historical.read(), error: error instanceof Error ? { message: error.message, ...(error as object) } : error,
      ownerUnchanged, afterDispose: sent });
    expect(calls).toBe(1);
    expect(order.slice(0, 3)).toEqual(['after-native-before-recipient', 'confirmed', 'after-recipient']);
    expect(ownerUnchanged).toBe(true); expect(saved).toEqual({ x: 7, y: 0 });
    expect(before).toEqual([]); expect(final).toEqual([{ x: 7, y: 0 }]); expect(sent).toEqual(final);
    // Receipt attribution/error is recorded, not invented from timing alone.
    // A comparator diagnostic must additionally establish a was not filtered
    // solely because it became confirmed after source admission.
  } finally { tail?.(); release?.(); c.dispose(); tree.destroy(); }
});

it('late aggregate enrollment with an open contributor cannot suppress useful value work', async () => {
  const tree = signalTree({ pair: { x: 0, y: 0 } }, { enhancers: [transactions()] });
  const controller = link(tree.$.pair, { set: () => { /* Independent transport relationship. */ } });
  const sent: { x: number; y: number }[] = [];
  let c: ReturnType<typeof link> | undefined;
  let receipt: PublicationReceipt | undefined;
  const projections: { unresolved: boolean; pending: number; invalid: boolean }[] = [];
  const occurrenceReads: number[] = [];
  const originalProject = lifecycle.projectRevision;
  const projectSpy = vi.spyOn(lifecycle, 'projectRevision').mockImplementation((...args) => {
    projections.push({ unresolved: args[3] ?? false, pending: args[2].owners.filter(owner => owner.outcome === 'pending').length, invalid: args[2].invalid });
    return originalProject(...args);
  });
  const originalProof = RecipientOccurrences.prototype.proof;
  const occurrenceSpy = vi.spyOn(RecipientOccurrences.prototype, 'proof').mockImplementation(function (this: RecipientOccurrences) {
    occurrenceReads.push(this.unresolved());
    return originalProof.call(this);
  });
  try {
    const p = tree.transact(() => tree.$.pair.y(7));
    const beforeOwner = p.inspect(); let outerCalls = 0, innerCalls = 0;
    controller.declare({ kind: 'dependent', owners: [p] }, () => {
      outerCalls++;
      // New installed source support remains inside an unfinished real validation
      // horizon. Enroll the aggregate afterward so it sees that source occurrence.
      tree.$.pair.y(value => value);
      c = link(tree.$.pair, { set: value => { sent.push(value); } });
      receipt = c.declare({ kind: 'dependent', owners: [p] }, () => {
        innerCalls++;
        tree.$.pair(current => ({ x: 1, y: current.y }));
      });
      expect(sent).toEqual([]);
    });
    await drain(); const before = [...sent];
    const ownerUnchanged = JSON.stringify(p.inspect()) === JSON.stringify(beforeOwner);
    p.confirm(); await drain();
    if (!c) throw new Error('aggregate connection not created');
    await c.settled(); await drain();
    const final = [...sent], terminal = receipt?.read();
    c.dispose(); tree.$.pair.x(2); await drain();
    record({ case: 'open-aggregate', outerCalls, innerCalls, projections, occurrenceReads,
      before, final, terminal, ownerUnchanged, afterDispose: sent });
    expect([outerCalls, innerCalls]).toEqual([1, 1]); expect(ownerUnchanged).toBe(true);
    expect(before).toEqual([]); expect(final).toEqual([{ x: 1, y: 7 }]); expect(sent).toEqual(final);
    expect(terminal?.state).toBe('started');
    // Coverage witnesses, not runtime safety verdicts if they fail. Merely
    // passing the delivery checks is insufficient to qualify unresolved guarding.
    expect(occurrenceReads.some(count => count > 0)).toBe(true);
    expect(projections.some(row => row.unresolved)).toBe(true);
    expect(occurrenceReads.at(-1)).toBe(0);
  } finally { projectSpy.mockRestore(); occurrenceSpy.mockRestore(); c?.dispose(); controller.dispose(); tree.destroy(); }
});
