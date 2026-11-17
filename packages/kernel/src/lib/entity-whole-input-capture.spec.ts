import { describe, expect, it, vi } from 'vitest';
import { entityMap, signalTree, transactions } from '../index';
import * as lifecycle from './experimental-publication/lifecycle';
import { getEntityPublicationBinding, type EntityPublicationSource } from './internals/entity-publication';
import { ExactSubjectRuns } from './internals/exact-subject-runs';
import { getPathNotifier } from './path-notifier';

type Row = { id: string; value: number };
const flush = async () => {
  getPathNotifier().flushSync();
  for (let step = 0; step < 160; step++) await Promise.resolve();
};
const sourceFor = (node: object): EntityPublicationSource => {
  const binding = getEntityPublicationBinding(node);
  if (!binding) throw new Error('Entity publication binding missing');
  return binding.source;
};

/** The existing expanded View route is the reference, including its order.
 * Compare identities, not an owner-count summary that can hide substitutions. */
function exactCapture(source: EntityPublicationSource) {
  const views = source.captureViews() as readonly { requirement: lifecycle.NativeRequirement }[];
  const requirements = [...new Set(views.map(view => view.requirement))];
  const expected = requirements.map(lifecycle.captureNativeInput);
  const before = source.inspect();
  const captured = source.captureInput() as { native: readonly lifecycle.NativeInput[] };
  const after = source.inspect();
  expect(Object.isFrozen(captured.native)).toBe(true);
  expect(captured.native).toHaveLength(expected.length);
  for (const [index, actual] of captured.native.entries()) {
    expect(actual.requirement).toBe(expected[index].requirement);
    expect(Object.isFrozen(actual)).toBe(true);
    expect(Object.isFrozen(actual.owners)).toBe(true);
    expect(actual.owners).toHaveLength(expected[index].owners.length);
    actual.owners.forEach((owner, i) => expect(owner).toBe(expected[index].owners[i]));
    expect(actual.terminalRejectedRoles).toBe(expected[index].terminalRejectedRoles);
  }
  return { captured, represented: views.length, representedCount: after.wholeInputFactsRepresented - before.wholeInputFactsRepresented, visits: after.inputFactVisits - before.inputFactVisits };
}

describe('whole entity input capture', () => {
  it('counts ordinary whole capture once without requiring packed history', async () => {
    const tree = signalTree({ rows: entityMap<Row, string>() });
    const rows = tree.$.rows, source = sourceFor(rows);
    try {
      rows.setAll([{ id: 'first', value: 1 }, { id: 'second', value: 2 }]);
      await flush();
      rows.updateOne('first', { value: 3 });
      expect(rows.byIdOrFail('first').value()).toBe(3);
      expect(source.inspect().packedSubjects).toBe(0);
      const result = exactCapture(source);
      expect(result.represented).toBe(8);
      expect(result.representedCount).toBe(result.represented);
      expect(result.visits).toBe(result.represented);
    } finally { tree.destroy(); }
  });

  it('visits exact packed runs without expanding every forgotten subject before deduplication', async () => {
    const tree = signalTree({ rows: entityMap<Row, string>() }, { enhancers: [transactions()] });
    const rows = tree.$.rows, source = sourceFor(rows);
    try {
      for (let cycle = 0; cycle < 3; cycle++) {
        const pending = tree.transact(() => rows.setAll(Array.from({ length: 20 }, (_, index) => ({ id: `row${index}`, value: cycle * 100 + index }))));
        await flush();
        pending.rollback();
        await flush();
      }
      expect(rows.all()).toEqual([]);
      expect(source.inspect()).toMatchObject({ packedSubjects: 60, packedRuns: 3, unpackedSubjectFacets: 0 });
      const result = exactCapture(source);
      expect(result.represented).toBe(120);
      expect(result.representedCount).toBe(120);
      expect(result.captured.native).toHaveLength(3);
      expect(result.captured.native.every(input => input.owners.some(owner => owner.outcome === 'rolled-back'))).toBe(true);
      // This is an executed-work bound; logical coverage remains 120 facts.
      expect.soft(result.visits).toBe(6);

      // Independent of the runtime's diagnostic counter: intercept the real
      // per-subject iterator, proving the positive control observes expansion.
      const entries = ExactSubjectRuns.prototype.entries;
      let yielded = 0;
      const spy = vi.spyOn(ExactSubjectRuns.prototype, 'entries').mockImplementation(function* (this: ExactSubjectRuns<unknown>) {
        for (const entry of entries.call(this)) { yielded++; yield entry; }
      });
      try {
        expect(source.captureViews()).toHaveLength(120);
        expect(yielded).toBe(60);
        yielded = 0;
        const again = source.captureInput() as { native: readonly lifecycle.NativeInput[] };
        expect.soft(yielded).toBe(0);
        expect(again.native).not.toBe(result.captured.native);
        expect(Object.isFrozen(again.native)).toBe(true);
        expect(again.native).toHaveLength(result.captured.native.length);
        again.native.forEach((input, index) => {
          expect(input).not.toBe(result.captured.native[index]);
          expect(Object.isFrozen(input)).toBe(true);
          expect(input.requirement).toBe(result.captured.native[index].requirement);
          expect(input.owners).not.toBe(result.captured.native[index].owners);
          expect(Object.isFrozen(input.owners)).toBe(true);
        });
      } finally { spy.mockRestore(); }
    } finally { tree.destroy(); }
  });

  it('keeps first-occurrence reference order across packed facts, reverse fallback and active fields', async () => {
    const tree = signalTree({ rows: entityMap<Row, string>() }, { enhancers: [transactions()] });
    const rows = tree.$.rows, source = sourceFor(rows);
    try {
      const bulk = tree.transact(() => rows.setAll(Array.from({ length: 12 }, (_, index) => ({ id: `bulk${index}`, value: index }))));
      await flush();
      bulk.rollback();
      await flush();
      exactCapture(source);

      const distinct = tree.transact(() => {
        for (let index = 0; index < 8; index++) rows.addOne({ id: `distinct${index}`, value: index });
      });
      await flush();
      distinct.rollback();
      await flush();
      expect(source.inspect().packedSubjects).toBeGreaterThan(0);
      expect(source.inspect().unpackedSubjectFacets).toBeGreaterThan(0);
      exactCapture(source);

      rows.addOne({ id: 'bulk0', value: 91 });
      const held = rows.byIdOrFail('bulk0');
      const pending = tree.transact(() => held.value(92));
      const issued = exactCapture(source).captured;
      const issuedOwners = issued.native.map(input => [...input.owners]);
      expect(issuedOwners.flat().some(owner => owner.outcome === 'pending')).toBe(true);
      await flush();
      exactCapture(source);
      pending.confirm();
      const fresh = exactCapture(source).captured;
      expect(fresh.native.flatMap(input => input.owners).some(owner => owner.outcome === 'confirmed')).toBe(false);
      expect(issuedOwners.flat().some(owner => owner.outcome === 'confirmed')).toBe(true);
      issued.native.forEach((input, index) => {
        expect(input.owners).toHaveLength(issuedOwners[index].length);
        input.owners.forEach((owner, i) => expect(owner).toBe(issuedOwners[index][i]));
      });

      rows.changeId('bulk0', 'renamed');
      exactCapture(source);
      rows.removeOne('renamed');
      await flush();
      expect(held()).toBeUndefined();
      exactCapture(source);
      rows.addOne({ id: 'bulk0', value: 93 });
      await flush();
      expect(rows.byIdOrFail('bulk0').value()).toBe(93);
      expect(held()).toBeUndefined();
      exactCapture(source);
    } finally { tree.destroy(); }
  });
});
