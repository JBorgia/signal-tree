import { describe, expect, it, vi } from 'vitest';
import { signalTree } from '../../lib/signal-tree';
import { entityMap } from '../../lib/markers/entity-map';
import { undoable } from '../../lib/undoable';
import { restoration } from './restoration';
import { transactions } from '../transactions/transactions';
import { entityMembershipReader } from '../../lib/internals/entity-membership-view';
import { StructuralStore } from '../../lib/physical/structural-store';

// Carried from v15 012fd11d (v16 integration slice 6; preserved in slice 4 as
// docs/audits/2026-10-01-v16-integration/preserved/entity-membership-capture.spec.ts.txt):
// `.transaction(` -> `.transact(`. One expectation adapted (class b), marked.
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
type Row = { id: string; n: number };

describe('production entity membership capture', () => {
  it('publishes prepared membership only after every collection and plain member installs', async () => {
    const tree = signalTree({
      left: entityMap<Row, string>(), right: entityMap<Row, string>(),
      profile: { n: 1 } as { n?: number },
    }, { enhancers: [restoration()] });
    try {
      tree.$.left.addOne({ id: 'a', n: 1 });
      tree.$.right.addOne({ id: 'b', n: 2 }); await flush();
      const reader = entityMembershipReader(tree)!;
      undoable(() => { tree.$.left.clear(); tree.$.right.clear(); tree.$.profile({}); });
      await flush();
      const seen: unknown[] = [];
      reader.subscribe(() => seen.push({
        members: reader.snapshot().collections.map((collection) => collection.members.map((member) => member.key)),
        profile: tree.$.profile(),
      }));
      tree.undo();
      expect(seen).toEqual(Array.from({ length: 2 }, () => ({ members: [['a'], ['b']], profile: { n: 1 } })));
      seen.length = 0;
      tree.redo();
      expect(seen).toEqual(Array.from({ length: 2 }, () => ({ members: [[], []], profile: {} })));
    } finally { tree.destroy(); }
  });

  it('protects a committed pending reorder before membership callbacks run', async () => {
    const tree = signalTree({ rows: entityMap<Row, string>() }, { enhancers: [transactions(), restoration()] });
    try {
      const a = { id: 'a', n: 1 }, b = { id: 'b', n: 2 };
      tree.$.rows.setAll([a, b]); await flush();
      undoable(() => tree.$.rows.setAll([b, a])); await flush();
      let failure: unknown;
      const reader = entityMembershipReader(tree)!;
      const release = reader.subscribe(() => { try { tree.undo(); } catch (error) { failure = error; } });
      const pending = tree.transact(() => tree.$.rows.setAll([a, b]));
      release();
      expect(String(failure)).toMatch(/ST1034/);
      expect(reader.snapshot().collections[0].members.map((member) => member.key)).toEqual(['a', 'b']);
      pending.rollback();
      undoable(() => tree.$.rows.setAll([a, b])); await flush();
      tree.undo();
      expect(tree.$.rows.ids()).toEqual(['b', 'a']);
    } finally { tree.destroy(); }
  });

  it('keeps scalar compensation out of the following authored baseline', async () => {
    const tree = signalTree({ n: 0 }, { enhancers: [transactions(), restoration()] });
    try {
      undoable(() => tree.$.n(1)); await flush();
      const pending = tree.transact(() => tree.$.n(2));
      pending.rollback();
      undoable(() => tree.$.n(3)); await flush();
      expect(tree.getRestorationHistory().map(({ state }) => state)).toEqual([{ n: 1 }, { n: 3 }]);
      tree.undo();
      expect(tree.$.n()).toBe(1);
      tree.redo();
      expect(tree.$.n()).toBe(3);
    } finally { tree.destroy(); }
  });

  it('keeps member compensation out of the following authored omission', async () => {
    const tree = signalTree({ profile: { n: 1 } as { n?: number } }, { enhancers: [transactions(), restoration()] });
    try {
      const pending = tree.transact(() => tree.$.profile({}));
      pending.rollback();
      undoable(() => tree.$.profile({})); await flush();
      expect(tree.canUndo()).toBe(true);
      tree.undo();
      expect(tree.$.profile()).toEqual({ n: 1 });
      tree.redo();
      expect(tree.$.profile()).toEqual({});
    } finally { tree.destroy(); }
  });

  it.each([1000, 10000])('point deltas never scan an inventory of %s rows', (size) => {
    const tree = signalTree({ rows: entityMap<Row, string>() });
    try {
      tree.$.rows.setAll(Array.from({ length: size }, (_, id) => ({ id: String(id), n: 0 })));
      const reader = entityMembershipReader(tree)!;
      const events: unknown[] = [];
      reader.subscribe((event) => events.push(event));
      const scan = vi.spyOn(StructuralStore.prototype, 'activeKeysSnapshot');
      try {
        tree.$.rows.addOne({ id: 'new', n: 1 });
        tree.$.rows.changeId('new', 'renamed');
        tree.$.rows.updateOne('renamed', { n: 2 });
        tree.$.rows.removeOne('renamed');
        expect(events).toHaveLength(3);
        expect(scan).not.toHaveBeenCalled();
      } finally { scan.mockRestore(); }
    } finally { tree.destroy(); }
  });

  it.each([false, true])('retains an authored removal following rollback in the same tick (reader=%s)', async (observe) => {
    const tree = signalTree({ rows: entityMap<Row, string>() }, { enhancers: [transactions(), restoration()] });
    try {
      tree.$.rows.addOne({ id: 'email@host.test', n: 1 }); await flush();
      if (observe) entityMembershipReader(tree)!.subscribe(() => undefined);
      const pending = tree.transact(() => tree.$.rows.removeOne('email@host.test'));
      pending.rollback();
      expect(tree.$.rows.has('email@host.test')()).toBe(true);
      undoable(() => tree.$.rows.removeOne('email@host.test'));
      await flush();
      expect(tree.canUndo()).toBe(true);
      tree.undo();
      expect(tree.$.rows.ids()).toEqual(['email@host.test']);
    } finally { tree.destroy(); }
  });

  it.each(['undo', 'redo'] as const)('protects pending membership before reader callbacks can %s', async (operation) => {
    const tree = signalTree({ rows: entityMap<Row, string>() }, { enhancers: [transactions(), restoration()] });
    try {
      undoable(() => tree.$.rows.addOne({ id: 'a', n: 0 })); await flush();
      if (operation === 'redo') tree.undo();
      let failure: unknown;
      const reader = entityMembershipReader(tree)!;
      const release = reader.subscribe(() => { try { tree[operation](); } catch (error) { failure = error; } });
      const pending = tree.transact(() => {
        if (operation === 'undo') tree.$.rows.removeOne('a');
        else tree.$.rows.addOne({ id: 'b', n: 1 });
      });
      release();
      if (operation === 'undo') {
        expect(String(failure)).toMatch(/ST1034/);
        expect(reader.snapshot().collections[0].members.map((member) => member.key)).toEqual([]);
      } else {
        // v16 (slice 6, class b): v15 refused this redo as a collection-wide
        // overlap ('rows.a' overlaps a pending transaction), with or without a
        // reader. v16 pending footprints are lifetime-scoped: re-adding
        // lifetime a is independent of the pending lifetime b (L16), so the
        // redo applies; rollback would remove only b. The same-lifetime case
        // below keeps the protection this fixture was written for.
        expect(failure).toBeUndefined();
        expect(reader.snapshot().collections[0].members.map((member) => member.key)).toEqual(['b', 'a']);
      }
      pending.confirm();
    } finally { tree.destroy(); }
  });

  // v16 control (slice 6): the redo direction of the protection above, on the
  // SAME lifetime. Refused on v15 and v16 alike.
  it('protects pending membership of the same lifetime before a reader callback can redo', async () => {
    const tree = signalTree({ rows: entityMap<Row, string>() }, { enhancers: [transactions(), restoration()] });
    try {
      tree.$.rows.addOne({ id: 'a', n: 0 }); await flush();
      undoable(() => tree.$.rows.removeOne('a')); await flush();
      tree.undo();
      let failure: unknown;
      const reader = entityMembershipReader(tree)!;
      const release = reader.subscribe(() => { try { tree.redo(); } catch (error) { failure = error; } });
      const pending = tree.transact(() => tree.$.rows.changeId('a', 'z'));
      release();
      expect(String(failure)).toMatch(/ST1034/);
      expect(reader.snapshot().collections[0].members.map((member) => member.key)).toEqual(['z']);
      pending.confirm();
      expect(tree.$.rows.ids()).toEqual(['z']);
    } finally { tree.destroy(); }
  });
});
