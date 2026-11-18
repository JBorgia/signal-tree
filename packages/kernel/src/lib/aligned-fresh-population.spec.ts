import { describe, expect, it, vi } from 'vitest';
import { entityMap, link, signalTree, transactions } from '../index';
import { EntityOrdinaryTopology } from './physical/entity-ordinary-topology';
import { withWriteContext } from './write-context';

type Row = { id: string; n: number; nested?: { value: number } };
const make = () => signalTree({ rows: entityMap<Row, string>() }, { enhancers: [transactions()] });
const flush = async () => { for (let i = 0; i < 120; i++) await Promise.resolve(); };

describe('aligned fresh population', () => {
  it('preserves an issued nested payload across later SignalTree writes', async () => {
    const tree = make();
    const input = { id: 'a', n: 1, nested: { value: 7 } };
    const sent: Row[][] = [];
    let connection: ReturnType<typeof link> | undefined;
    try {
      tree.$.rows.setAll([input]);
      connection = link(tree.$.rows, { set: value => { sent.push(value); } });
      tree.$.rows.updateOne('a', { n: 2 });
      await flush(); await connection.settled();
      const retained = sent.at(-1);
      expect(retained?.[0].nested).toEqual({ value: 7 });
      tree.$.rows.updateOne('a', { nested: { value: 8 } });
      await flush(); await connection.settled();
      expect(retained?.[0].nested).toEqual({ value: 7 });
      expect(sent.at(-1)?.[0].nested).toEqual({ value: 8 });
    } finally { connection?.dispose(); tree.destroy(); }
  });

  it.each([false, true])('preserves initial deduplication, append/prepend order, snapshots and rollback lifetimes (generic=%s)', async generic => {
    const tree = make();
    const sent: Row[][] = [];
    let connection: ReturnType<typeof link> | undefined;
    const observation = vi.spyOn(EntityOrdinaryTopology.prototype, 'prepareInstall');
    const forceGeneric = generic ? vi.spyOn(EntityOrdinaryTopology.prototype, 'isAligned').mockReturnValue(false) : undefined;
    try {
      tree.$.rows.setAll([{ id: 'a', n: 1 }, { id: 'b', n: 2 }, { id: 'a', n: 3 }]);
      expect(tree.$.rows.all()).toEqual([{ id: 'a', n: 3 }, { id: 'b', n: 2 }]);
      expect(observation.mock.calls.some(([ordinary, physical]) => ordinary === physical)).toBe(!generic);
      connection = link(tree.$.rows, { set: value => { sent.push(value); } });
      const held = tree.$.rows.byIdOrFail('a');
      const append = tree.transact(() => tree.$.rows.addMany([{ id: 'c', n: 4 }, { id: 'd', n: 5 }]));
      expect(tree.$.rows.ids()).toEqual(['a', 'b', 'c', 'd']);
      append.rollback();
      await flush(); await connection.settled();
      expect(tree.$.rows.ids()).toEqual(['a', 'b']);
      expect(tree.$.rows.byIdOrFail('a')).toBe(held);
      const prepend = tree.transact(() => tree.$.rows.prependMany([{ id: 'x', n: 6 }, { id: 'y', n: 7 }]));
      expect(tree.$.rows.ids()).toEqual(['x', 'y', 'a', 'b']);
      prepend.confirm();
      await flush(); await connection.settled();
      expect(sent.at(-1)?.map(row => row.id)).toEqual(['x', 'y', 'a', 'b']);
      const retained = sent.at(-1);
      tree.$.rows.updateOne('x', { n: 99 });
      await flush(); await connection.settled();
      expect(retained?.[0].n).toBe(6);
      expect(sent.at(-1)?.[0].n).toBe(99);
    } finally { forceGeneric?.mockRestore(); observation.mockRestore(); connection?.dispose(); tree.destroy(); }
  });

  it('does not align inspected or already divergent membership', async () => {
    const tree = make();
    const sent: Row[][] = [];
    const connection = link(tree.$.rows, { set: value => { sent.push(structuredClone(value)); } });
    const observation = vi.spyOn(EntityOrdinaryTopology.prototype, 'prepareInstall');
    try {
      withWriteContext({ participation: 'inspection' }, () => tree.$.rows.addMany([{ id: 'hidden', n: 1 }]));
      tree.$.rows.addMany([{ id: 'a', n: 2 }, { id: 'b', n: 3 }]);
      await flush(); await connection.settled();
      expect(tree.$.rows.ids()).toEqual(['hidden', 'a', 'b']);
      expect(sent.at(-1)).toEqual([{ id: 'a', n: 2 }, { id: 'b', n: 3 }]);
      expect(observation.mock.calls.length).toBeGreaterThan(0);
      expect(observation.mock.calls.every(([ordinary, physical]) => ordinary !== physical)).toBe(true);
    } finally { observation.mockRestore(); connection.dispose(); tree.destroy(); }
  });

  it.each(['before', 'after-plan'] as const)('keeps a foreign owner opened %s in fresh publication evidence', async when => {
    const tree = make();
    const foreign = signalTree({ n: 0 }, { enhancers: [transactions()] });
    let pending: ReturnType<typeof foreign.transact> | undefined;
    const sent: Row[][] = [];
    let connection: ReturnType<typeof link> | undefined;
    const original = EntityOrdinaryTopology.prototype.prepareInstall;
    const observation = vi.spyOn(EntityOrdinaryTopology.prototype, 'prepareInstall').mockImplementation(function(this: EntityOrdinaryTopology<string>, ...args) {
      const plan = original.apply(this, args);
      if (when === 'after-plan' && !pending) pending = foreign.transact(() => foreign.$.n(1));
      return plan;
    });
    try {
      if (when === 'before') pending = foreign.transact(() => foreign.$.n(1));
      tree.$.rows.setAll([{ id: 'a', n: 1 }, { id: 'b', n: 2 }]);
      expect(pending).toBeDefined();
      observation.mockRestore();
      connection = link(tree.$.rows, { set: value => { sent.push(structuredClone(value)); } });
      connection.declare({ kind: 'independent' }, () => tree.$.rows.updateOne('a', { n: 3 }));
      await flush(); expect(sent).toEqual([]);
      pending!.confirm(); await flush(); await connection.settled();
      expect(sent.at(-1)).toEqual([{ id: 'a', n: 3 }, { id: 'b', n: 2 }]);
    } finally { observation.mockRestore(); pending?.confirm(); connection?.dispose(); tree.destroy(); foreign.destroy(); }
  });

  it('refuses stale aligned plans while retaining a completed reentrant addition', () => {
    const tree = make();
    const original = EntityOrdinaryTopology.prototype.prepareInstall;
    let reentered = false;
    const observation = vi.spyOn(EntityOrdinaryTopology.prototype, 'prepareInstall').mockImplementation(function(this: EntityOrdinaryTopology<string>, ...args) {
      const plan = original.apply(this, args);
      if (!reentered) { reentered = true; tree.$.rows.addOne({ id: 'inner', n: 7 }); }
      return plan;
    });
    try {
      expect(() => tree.$.rows.setAll([{ id: 'outer', n: 1 }])).toThrow(/reentered installation/);
      expect(reentered).toBe(true);
      expect(tree.$.rows.all()).toEqual([{ id: 'inner', n: 7 }]);
    } finally { observation.mockRestore(); tree.destroy(); }
  });
});
