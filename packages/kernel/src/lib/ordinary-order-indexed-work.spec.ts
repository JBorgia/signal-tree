import { expect, it, vi } from 'vitest';
import { entityMap, signalTree, transactions } from '../index';
import { EntityPlacementStage } from './physical/entity-placement-stage';
import { EntityOrdinaryTopology } from './physical/entity-ordinary-topology';
import { withWriteContext } from './write-context';
import { installProductionSubstrateStatsForTesting, clearProductionSubstrateStatsForTesting, resetProductionSubstrateStatsForTesting } from './internals/production-substrate-stats';

const flush = async () => { for (let i = 0; i < 80; i++) await Promise.resolve(); };

it.each([16, 128, 1024])('fixed local divergence preserves indexed point inverse work at %i members', async size => {
  const tree = signalTree({ rows: entityMap<{id:string;n:number},string>() }, { enhancers: [transactions()] });
  const reads = vi.spyOn(EntityPlacementStage.prototype, 'read');
  const installs = vi.spyOn(EntityOrdinaryTopology.prototype, 'install');
  try {
    tree.$.rows.setAll(Array.from({length:size}, (_,i) => ({id:String(i),n:0})));
    await flush();
    const row = tree.$.rows.byIdOrFail('0');
    withWriteContext({participation:'inspection'}, () => tree.$.rows.removeOne(String(size - 1)));
    await flush();
    const stats = installProductionSubstrateStatsForTesting();
    reads.mockClear(); installs.mockClear();
    const pending = tree.transact(() => row.n(1));
    expect(reads.mock.calls.length).toBeLessThanOrEqual(256);
    expect(installs.mock.calls.length).toBeLessThanOrEqual(256);
    expect(stats.structuralActiveKeyEntriesVisited).toBe(0);
    reads.mockClear(); installs.mockClear(); resetProductionSubstrateStatsForTesting(stats);
    pending.rollback();
    expect(row.n()).toBe(0);
    expect(tree.$.rows.byIdOrFail('0')).toBe(row);
    expect(reads.mock.calls.length).toBeLessThanOrEqual(256);
    expect(installs.mock.calls.length).toBeLessThanOrEqual(256);
    expect(stats.structuralActiveKeyEntriesVisited).toBe(0);
  } finally { reads.mockRestore(); installs.mockRestore(); clearProductionSubstrateStatsForTesting(); tree.destroy(); }
});

it('repeated indexed inverses preserve an independent live recovery obligation', async () => {
  const tree = signalTree({ rows: entityMap<{id:string;n:number},string>() }, { enhancers: [transactions()] });
  const reads = vi.spyOn(EntityPlacementStage.prototype, 'read');
  const installs = vi.spyOn(EntityOrdinaryTopology.prototype, 'install');
  try {
    tree.$.rows.setAll(Array.from({length:128}, (_,i) => ({id:String(i),n:0})));
    await flush();
    const held = tree.$.rows.byIdOrFail('0');
    const live = tree.transact(() => held.n(7));
    reads.mockClear(); installs.mockClear();
    for (let i = 0; i < 12; i++) {
      const row = tree.$.rows.byIdOrFail('1');
      const p = tree.transact(() => row.n(i + 1));
      p.rollback();
      expect(row.n()).toBe(0);
      expect(held.n()).toBe(7);
      expect(() => live.inspect()).not.toThrow();
    }
    expect(reads.mock.calls.length).toBeLessThanOrEqual(12 * 256);
    expect(installs.mock.calls.length).toBeLessThanOrEqual(12 * 256);
    live.rollback();
    expect(held.n()).toBe(0);
  } finally { reads.mockRestore(); installs.mockRestore(); tree.destroy(); }
});

// Test-only inspection of existing private storage, never a runtime hook or GC claim.
function ownerCounts(owner: object) {
  const divergent: unknown = Reflect.get(owner, 'divergent');
  const displaced: unknown = Reflect.get(owner, 'displaced');
  if (!(divergent instanceof Map) || !(displaced instanceof Map))
    throw new Error('Owner index layout unavailable; retention test cannot measure its claim');
  return { divergent: divergent.size, displaced: displaced.size };
}

it.each([16, 128, 1024])('full inspection divergence converges without retaining historical adjacency at %i members', async size => {
  const tree = signalTree({ rows: entityMap<{id:string;n:number},string>() }, { enhancers: [transactions()] });
  const owners = new Set<object>();
  const original = EntityOrdinaryTopology.prototype.prepareInstall;
  const observation = vi.spyOn(EntityOrdinaryTopology.prototype, 'prepareInstall').mockImplementation(function (this: EntityOrdinaryTopology<string>, ordinary, physical) {
    owners.add(this);
    return original.call(this, ordinary, physical);
  });
  try {
    const input = Array.from({length:size}, (_,i) => ({id:String(i),n:0}));
    tree.$.rows.setAll(input); await flush();
    expect(owners.size).toBe(1);
    const owner = [...owners][0];
    expect(ownerCounts(owner)).toEqual({divergent:0,displaced:0});
    withWriteContext({participation:'inspection'}, () => tree.$.rows.setAll([...input].reverse()));
    await flush();
    expect(ownerCounts(owner).divergent).toBe(size);
    // Full order intentionally processes N; the point phase below must not.
    const reads = vi.spyOn(EntityPlacementStage.prototype, 'read');
    const installs = vi.spyOn(EntityOrdinaryTopology.prototype, 'install');
    try {
      const p = tree.transact(() => tree.$.rows.byIdOrFail('0').n(1));
      p.rollback();
      expect(tree.$.rows.byIdOrFail('0').n()).toBe(0);
      expect(reads.mock.calls.length).toBeLessThanOrEqual(512);
      expect(installs.mock.calls.length).toBeLessThanOrEqual(512);
    } finally { reads.mockRestore(); installs.mockRestore(); }
    withWriteContext({participation:'inspection'}, () => tree.$.rows.setAll(input));
    await flush();
    expect(tree.$.rows.ids()).toEqual(input.map(row => row.id));
    expect(ownerCounts(owner)).toEqual({divergent:0,displaced:0});
  } finally { observation.mockRestore(); tree.destroy(); }
});

it('staggered structural inverses preserve late lifetime recovery across repeated drains', async () => {
  const tree = signalTree({ rows: entityMap<{id:string;n:number},string>() }, { enhancers: [transactions()] });
  try {
    tree.$.rows.setAll([{id:'a',n:7},{id:'b',n:8},{id:'c',n:9}]); await flush();
    const a = tree.$.rows.byIdOrFail('a');
    const c = tree.$.rows.byIdOrFail('c');
    const older = tree.transact(() => tree.$.rows.removeOne('a'));
    for (let i=0;i<8;i++) {
      const newer = tree.transact(() => tree.$.rows.removeOne('c'));
      expect(c()).toBeUndefined();
      newer.rollback(); await flush();
      expect(tree.$.rows.byIdOrFail('c')).toBe(c);
      expect(c()?.n).toBe(9);
      expect(a()).toBeUndefined();
      expect(() => older.inspect()).not.toThrow();
    }
    older.rollback(); await flush();
    expect(tree.$.rows.ids()).toEqual(['a','b','c']);
    expect(tree.$.rows.byIdOrFail('a')).toBe(a);
    expect(a()?.n).toBe(7);
  } finally { tree.destroy(); }
});
