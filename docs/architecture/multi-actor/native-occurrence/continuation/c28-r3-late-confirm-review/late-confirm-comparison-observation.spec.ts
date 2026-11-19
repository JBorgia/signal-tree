import { appendFileSync } from 'node:fs';
import { expect, it, vi } from 'vitest';
import { link, signalTree, transactions, type PendingTransaction, type PublicationReceipt } from '../index';
import * as lifecycle from './experimental-publication/lifecycle';
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
  let lateCell: lifecycle.OwnerCell | undefined;
  let nativeCutoff: bigint | undefined, confirmationOrdinal: bigint | undefined;
  let observing = false;
  const comparisons: { cutoff: string; lateProtected: boolean; before: Record<string, boolean>; after: Record<string, boolean>; pendingDestinationPreserved: boolean; flagsUnchanged: boolean }[] = [];
  const originalComparison = lifecycle.comparisonObligations;
  const comparisonSpy = vi.spyOn(lifecycle, 'comparisonObligations').mockImplementation((proof, admission) => {
    const result = originalComparison(proof, admission);
    if (observing && lateCell) {
      const roles = ['owners', 'destination', 'input', 'validation', 'possible'] as const;
      const before = Object.fromEntries(roles.map(role => [role, (proof[role] ?? []).includes(lateCell!)]));
      const after = Object.fromEntries(roles.map(role => [role, (result[role] ?? []).includes(lateCell!)]));
      const flags = ['unknown', 'invalid', 'unavailableInput', 'historicalWindow', 'terminalRejectedRoles'] as const;
      comparisons.push({ cutoff: String(admission.cutoff), lateProtected: admission.protectedOwners.includes(lateCell), before, after,
        pendingDestinationPreserved: (proof.destination ?? []).filter(cell => cell.outcome === 'pending').every(cell => (result.destination ?? []).includes(cell) && result.owners.includes(cell)),
        flagsUnchanged: flags.every(flag => proof[flag] === result[flag]) });
    }
    return result;
  });
  // Private callback-capable preparation seam, enrolled before the actual Link.
  // It changes only authentic owner outcome; no proof/requirement injection.
  const release = preparePublicationMutations(tree.$.pair.x, (_mutation, _input, native) => {
    if (!armed) return undefined;
    expect(native).toBeDefined(); order.push('after-native-before-recipient');
    calls++; armed = false;
    if (!a) throw new Error('missing historical owner');
    nativeCutoff = (native as { comparison?: lifecycle.ComparisonAdmission }).comparison?.cutoff;
    a.confirm(); confirmationOrdinal = lifecycle.comparisonCutoff(); order.push('confirmed');
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
    const priorCells = new Set(lifecycle.pendingOwners());
    a = tree.transact(() => tree.$.q(1));
    lateCell = lifecycle.pendingOwners().find(cell => !priorCells.has(cell));
    expect(lateCell?.outcome).toBe('pending');
    const historical = c.declare({ kind: 'dependent', owners: [p, a] }, () => {
      tree.$(current => ({ ...current, pair: { ...current.pair } }));
    });
    await drain(); expect(sent).toEqual([]);
    const saved = tree.$.pair(), ownerBefore = p.inspect();
    let receipt: PublicationReceipt | undefined, error: unknown;
    armed = true; observing = true;
    try { receipt = c.declare({ kind: 'dependent', owners: [p] }, () => tree.$.pair.x(7)); }
    catch (caught) { error = caught; }
    await drain(); observing = false; const before = [...sent], beforeReceipt = receipt?.read();
    const ownerUnchanged = JSON.stringify(p.inspect()) === JSON.stringify(ownerBefore);
    p.confirm(); await drain(); await c.settled(); await drain();
    const final = [...sent], terminal = receipt?.read();
    c.dispose(); tree.$.pair.x(9); await drain();
    record({ case: 'late-confirm', calls, order, before, beforeReceipt, final, terminal,
      nativeCutoff: String(nativeCutoff), confirmationOrdinal: String(confirmationOrdinal), comparisons,
      historical: historical.read(), error: error instanceof Error ? { message: error.message, ...(error as object) } : error,
      ownerUnchanged, afterDispose: sent });
    expect(calls).toBe(1);
    expect(order.slice(0, 3)).toEqual(['after-native-before-recipient', 'confirmed', 'after-recipient']);
    expect(ownerUnchanged).toBe(true); expect(saved).toEqual({ x: 7, y: 0 });
    expect(before).toEqual([]); expect(final).toEqual([{ x: 7, y: 0 }]); expect(sent).toEqual(final);
    expect(nativeCutoff).toBeDefined(); expect(confirmationOrdinal).toBeDefined();
    expect(confirmationOrdinal! > nativeCutoff!).toBe(true);
    const actual = comparisons.filter(row => row.cutoff === String(nativeCutoff));
    expect(actual.length).toBeGreaterThan(0);
    const witnesses = actual.filter(row => row.before.input || row.before.validation);
    expect(witnesses.length).toBeGreaterThan(0);
    for (const row of witnesses) {
      expect(row.lateProtected).toBe(false);
      expect(row.after).toEqual(row.before);
      expect(row.pendingDestinationPreserved).toBe(true);
      expect(row.flagsUnchanged).toBe(true);
    }
    // Receipt attribution/error is recorded, not invented from timing alone.
    // A comparator diagnostic must additionally establish a was not filtered
    // solely because it became confirmed after source admission.
  } finally { comparisonSpy.mockRestore(); tail?.(); release?.(); c.dispose(); tree.destroy(); }
});

