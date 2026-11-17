import { describe, expect, it } from 'vitest';
import { entityMap, link, signalTree, transactions } from '../index';
import { getEntityPublicationBinding } from './internals/entity-publication';
import { installTerminalRecord } from './internals/intrinsic-mutation';
import { nativeProof, type NativeRequirement } from './experimental-publication/lifecycle';

type Row = { id: string; x: number; y: number };
const make = () => signalTree({ rows: entityMap<Row, string>() });
const flush = async () => { for (let i = 0; i < 120; i++) await Promise.resolve(); };

describe('deferred publication activation', () => {
  it('keeps a positive unobserved prefix cold, then seeds exact current values for late enrollment', async () => {
    const tree = make();
    const foreign = signalTree({ n: 0 }, { enhancers: [transactions()] });
    const source = getEntityPublicationBinding(tree.$.rows)!.source;
    let connection: ReturnType<typeof link> | undefined;
    try {
      expect(source.inspect().native, 'before population').toBe(0);
      tree.$.rows.setAll([{ id: 'a', x: 1, y: 2 }]);
      expect(tree.$.rows.count()).toBe(1);
      expect(source.inspect().native, 'after population and count').toBe(0);
      tree.$.rows.updateOne('a', { x: 3 });
      expect(source.inspect().native).toBe(0);
      const pending = foreign.transact(() => foreign.$.n(1));
      const sent: unknown[] = [];
      connection = link(tree.$.rows, { set: value => { sent.push(value); } });
      expect(source.inspect().native).toBe(1);
      connection.declare({ kind: 'independent' }, () => tree.$.rows.updateOne('a', { y: 4 }));
      await flush();
      expect(sent).toEqual([[{ id: 'a', x: 3, y: 4 }]]);
      pending.rollback();
      await connection.settled();
    } finally { connection?.dispose(); tree.destroy(); foreign.destroy(); }
  });

  it.each(['confirm', 'rollback'] as const)('activates before a foreign-window write and preserves its %s obligation', async settlement => {
    const tree = make();
    const foreign = signalTree({ n: 0 }, { enhancers: [transactions()] });
    let connection: ReturnType<typeof link> | undefined;
    try {
      tree.$.rows.setAll([{ id: 'a', x: 1, y: 2 }]);
      const pending = foreign.transact(() => foreign.$.n(1));
      tree.$.rows.updateOne('a', { x: 3 });
      expect(getEntityPublicationBinding(tree.$.rows)!.source.inspect().native).toBe(1);
      const sent: unknown[] = [];
      connection = link(tree.$.rows, { set: value => { sent.push(value); } });
      connection.declare({ kind: 'independent' }, () => tree.$.rows.updateOne('a', { y: 4 }));
      await flush(); expect(sent).toEqual([]);
      pending[settlement](); await flush();
      expect(sent).toEqual([[{ id: 'a', x: 3, y: 4 }]]);
      await connection.settled();
    } finally { connection?.dispose(); tree.destroy(); foreign.destroy(); }
  });

  it('activates before removal so held stale inputs keep their negative evidence until retirement', async () => {
    const tree = make();
    const foreign = signalTree({ n: 0 }, { enhancers: [transactions()] });
    const target = signalTree({ n: 0 });
    const sent: number[] = [];
    const connection = link(target.$.n, { set: value => { sent.push(value); } });
    try {
      tree.$.rows.setAll([{ id: 'a', x: 1, y: 2 }]);
      const held = tree.$.rows.byIdOrFail('a').x;
      tree.$.rows.removeOne('a');
      expect(getEntityPublicationBinding(tree.$.rows)!.source.inspect().native).toBe(1);
      const pending = foreign.transact(() => foreign.$.n(1));
      let calls = 0;
      connection.declare({ kind: 'independent' }, () => {
        try { held(value => { calls++; target.$.n(7); return value; }); }
        catch { /* A stale field remains unwritable; its callback is still an input consumer. */ }
      });
      await flush();
      expect(calls).toBe(1); expect(sent).toEqual([7]);
      pending.rollback(); await connection.settled();
    } finally { connection.dispose(); tree.destroy(); foreign.destroy(); target.destroy(); }
  });

  it('promotes at finalization when a foreign owner opens after preparation', () => {
    const tree = make();
    const foreign = signalTree({ n: 0 }, { enhancers: [transactions()] });
    try {
      tree.$.rows.setAll([{ id: 'a', x: 1, y: 2 }]);
      const source = getEntityPublicationBinding(tree.$.rows)!.source;
      // The public population establishes the seed; the private prepared unit
      // isolates the callback-capable preparation/finalization boundary.
      const edit = {subject: 1, before: {id: 'a', x: 1, y: 2}, after: {id: 'a', x: 3, y: 2}, fields: ['x']};
      const unit = source.prepare({id: {}, owner: -1, meta: undefined, ordinary: [edit], physical: [edit]})!;
      const pending = foreign.transact(() => foreign.$.n(1));
      unit.finalize?.(); unit.validate?.(); installTerminalRecord(unit.record); source.complete(unit.completion);
      const proof = nativeProof(source.evidence()!.field(1, 'x', 'ordinary') as NativeRequirement);
      expect(proof.possible?.length).toBe(1);
      expect(proof.possible?.[0].outcome).toBe('pending');
      pending.confirm();
    } finally { tree.destroy(); foreign.destroy(); }
  });

  it.each([false, true])('does not borrow a later declaration during finalization (eager=%s)', eager => {
    const tree = make();
    const foreign = signalTree({ n: 0 }, { enhancers: [transactions()] });
    const target = signalTree({ n: 0 });
    const connection = link(target.$.n, { set: () => undefined });
    try {
      tree.$.rows.setAll([{ id: 'a', x: 1, y: 2 }]);
      const source = getEntityPublicationBinding(tree.$.rows)!.source;
      if (eager) source.evidence();
      const edit = { subject: 1, before: {id: 'a', x: 1, y: 2}, after: {id: 'a', x: 3, y: 2}, fields: ['x'] };
      const unit = source.prepare({id: {}, owner: -1, meta: undefined, ordinary: [edit], physical: [edit]})!;
      const pending = foreign.transact(() => foreign.$.n(1));
      connection.declare({kind: 'dependent', owners: [pending]}, () => {
        unit.finalize?.(); unit.validate?.(); installTerminalRecord(unit.record); source.complete(unit.completion);
      });
      const proof = nativeProof(source.evidence()!.field(1, 'x', 'ordinary') as NativeRequirement);
      expect(proof.validation).toEqual([]);
      expect(proof.possible).toHaveLength(1);
      expect(proof.invalid).toBe(false);
      pending.confirm();
    } finally { connection.dispose(); tree.destroy(); foreign.destroy(); target.destroy(); }
  });

  it('materializes a sealed cold addition if a reader activates the source before installation', () => {
    const tree = make();
    const foreign = signalTree({ n: 0 }, { enhancers: [transactions()] });
    try {
      tree.$.rows.setAll([{ id: 'a', x: 1, y: 2 }]);
      const source = getEntityPublicationBinding(tree.$.rows)!.source;
      const row = {id: 'b', x: 3, y: 4};
      const edit = {subject: 2, before: undefined, after: row, fields: null,
        structural: {kind: 'add' as const, subject: 2, key: 'b', value: row}};
      const unit = source.prepare({id: {}, owner: -1, meta: undefined, ordinary: [edit], physical: [edit]})!;
      unit.finalize?.();
      const pending = foreign.transact(() => foreign.$.n(1));
      const oldInput = source.captureInput();
      expect(oldInput).toBeDefined();
      unit.validate?.(); installTerminalRecord(unit.record); source.complete(unit.completion);
      const proof = nativeProof(source.evidence()!.field(2, 'x', 'ordinary') as NativeRequirement);
      expect(proof.unavailableInput).toBe(false);
      expect(proof.possible).toEqual([]);
      expect(proof.historicalWindow).toBe(true);
      pending.rollback();
    } finally { tree.destroy(); foreign.destroy(); }
  });

  it('uses the full path for accessor-bearing rows so activation never invokes an unrecorded getter', () => {
    const tree = signalTree({ rows: entityMap<Row & { opaque: () => void }, string>() });
    let calls = 0;
    let armed = false;
    const source = getEntityPublicationBinding(tree.$.rows)!.source;
    const row = {
      opaque: () => undefined,
      id: 'a', y: 2,
      get x() { calls++; if (armed) source.captureInput(); return 1; },
    };
    try {
      tree.$.rows.setAll([row]);
      expect(calls).toBeGreaterThan(0);
      expect(source.inspect().native).toBe(1);
      const before = calls;
      armed = true;
      expect(source.captureInput()).toBeDefined();
      expect(calls).toBe(before);
    } finally { tree.destroy(); }
  });

  it('preserves clean issued support when a held cold source is first consumed after destruction', () => {
    const tree = make();
    const foreign = signalTree({ n: 0 }, { enhancers: [transactions()] });
    const source = getEntityPublicationBinding(tree.$.rows)!.source;
    try {
      tree.$.rows.setAll([{ id: 'a', x: 1, y: 2 }]);
      expect(source.inspect().native).toBe(0);
      tree.destroy();
      const pending = foreign.transact(() => foreign.$.n(1));
      const proof = nativeProof(source.evidence()!.field(1, 'x', 'ordinary') as NativeRequirement);
      expect(proof.unknown).toBe(false);
      expect(proof.possible).toEqual([]);
      pending.rollback();
    } finally { tree.destroy(); foreign.destroy(); }
  });
});
