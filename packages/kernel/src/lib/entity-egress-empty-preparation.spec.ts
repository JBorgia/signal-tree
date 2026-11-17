import { afterEach, describe, expect, it, vi } from 'vitest';
import { entityMap, link, signalTree, transactions } from '../index';
import { getOrCreateInternalTransactionRuntime } from '../enhancers/transactions/transactions';
import * as projections from './internals/entity-egress-projection';
import {
  entityPublicationOrdinary,
  getEntityPublicationBinding,
  type EntityPublicationPacket,
} from './internals/entity-publication';
import { installTerminalRecord } from './internals/intrinsic-mutation';

type Row = { id: number; value: number };
type Inventory = {
  __acquireEntityHandleForTesting(key: number): { subjectId: number };
  __inspectSubjectResources(subject: number): { state: string } | undefined;
  __listSubjectReclamationCandidates(): readonly number[];
};
type Projection = ReturnType<typeof projections.createEntityEgressProjection>;
const flush = async () => {
  for (let i = 0; i < 160; i++) await Promise.resolve();
};
const make = () => signalTree(
  { rows: entityMap<Row, number>() },
  { enhancers: [transactions()] }
);
const inventory = (rows: unknown) => rows as Inventory;
const sourceOf = (rows: object) => {
  const binding = getEntityPublicationBinding(rows);
  if (!binding) throw new Error('Expected a bound entity publication source');
  return binding.source;
};
const emptyPacket = (): EntityPublicationPacket => ({
  owner: 0, id: {}, meta: undefined, physical: [], ordinary: [],
});
function noProjectionEdits(packet: EntityPublicationPacket): boolean {
  return packet.physical.length === 0 &&
    entityPublicationOrdinary(packet).length === 0 &&
    packet.physicalOrder === undefined && packet.ordinaryOrder === undefined &&
    !packet.ordinaryPlacements?.length && packet.seed === undefined;
}

// Count actual accesses on the constructed projection's own row Map. This is
// independent of native work counters and does not simulate the suspect loop.
function observeProjectionWork() {
  const original = projections.createEntityEgressProjection;
  const observed: Projection[] = [];
  const work = { emptyPreparations: 0, rowGets: 0 };
  const staged: Array<{
    packet: EntityPublicationPacket;
    result: ReturnType<Projection['prepare']>;
  }> = [];
  vi.spyOn(projections, 'createEntityEgressProjection').mockImplementation(
    (...args: Parameters<typeof original>) => {
      const projection = original(...args);
      const rows = projection.state().rows;
      const get = rows.get.bind(rows);
      const prepare = projection.prepare.bind(projection);
      let count = false;
      vi.spyOn(rows, 'get').mockImplementation(key => {
        if (count) work.rowGets++;
        return get(key);
      });
      vi.spyOn(projection, 'prepare').mockImplementation((packet, evidence) => {
        const previous = count;
        count = noProjectionEdits(packet);
        if (count) work.emptyPreparations++;
        try {
          const result = prepare(packet, evidence);
          staged.push({ packet, result });
          return result;
        } finally {
          count = previous;
        }
      });
      observed.push(projection);
      return projection;
    }
  );
  return { observed, work, staged, reset() {
    work.emptyPreparations = 0; work.rowGets = 0; staged.length = 0;
  } };
}
afterEach(() => vi.restoreAllMocks());

describe('direct collection empty publication preparation', () => {
  it.each([false, true])('does not render surviving rows once per retired lifetime (other participant: %s)', async withOtherParticipant => {
    const probe = observeProjectionWork();
    const tree = make(), rows = tree.$.rows;
    const runtime = getOrCreateInternalTransactionRuntime(tree);
    const deliveries: Array<readonly Row[]> = [];
    const connection = link(rows, { set: value => { deliveries.push(value); } });
    const first = Array.from({ length: 16 }, (_, id) => ({ id, value: id + 10 }));
    const second = first.map(row => ({ id: row.id + 100, value: row.value + 1000 }));
    let off = () => { /* Participant is attached after the initial settlement. */ };
    try {
      tree.transact(() => rows.setAll(first)).confirm();
      await flush(); await connection.settled();
      expect(deliveries).toEqual([first]);
      expect(probe.observed.length).toBeGreaterThan(0);
      const held = rows.all();
      const retired = first.map(row => inventory(rows).__acquireEntityHandleForTesting(row.id).subjectId);
      const calls = { prepare: 0, install: 0, complete: 0 };
      const completions = new Set<object>();
      if (withOtherParticipant) off = sourceOf(rows).subscribe({
        prepare(packet) {
          if (!noProjectionEdits(packet)) return undefined;
          calls.prepare++;
          const completion = {};
          completions.add(completion);
          return { record: { writes: [{
            map: { set() { calls.install++; } }, key: undefined, value: undefined,
          }], adds: [] }, completion };
        },
        complete(completion) {
          expect(completions.delete(completion)).toBe(true);
          calls.complete++;
          expect(rows.all()).toEqual(second);
        },
      });
      const pending = tree.transact(() => rows.setAll(second));
      expect(runtime.getPendingTurnCount()).toBe(1);
      await flush();
      expect(deliveries).toEqual([first]);
      for (const subject of retired)
        expect(inventory(rows).__inspectSubjectResources(subject)).toBeDefined();
      probe.reset();
      pending.confirm();
      await flush(); await connection.settled();
      expect(runtime.getPendingTurnCount()).toBe(0);
      expect(rows.all()).toEqual(second);
      expect(deliveries).toEqual([first, second]);
      expect(held).toEqual(first);
      const expectedCalls = withOtherParticipant ? 16 : 0;
      expect(calls).toEqual({ prepare: expectedCalls, install: expectedCalls, complete: expectedCalls });
      expect(completions.size).toBe(0);
      expect(inventory(rows).__listSubjectReclamationCandidates()).toEqual([]);
      for (const subject of retired)
        expect(inventory(rows).__inspectSubjectResources(subject)).toBeUndefined();
      for (const row of second) {
        const subject = inventory(rows).__acquireEntityHandleForTesting(row.id).subjectId;
        expect(inventory(rows).__inspectSubjectResources(subject)?.state).toBe('active');
        expect(rows.byIdOrFail(row.id).value()).toBe(row.value);
      }
      // Baseline fa250790 renders 16 rows for each of 16 empty retirement
      // preparations. Useful delivery/ownership assertions above run first.
      expect(probe.work.rowGets).toBe(0);
      expect(probe.work.emptyPreparations).toBe(0);
    } finally {
      off(); connection.dispose(); tree.destroy(); await flush();
    }
  });

  it('keeps direct helper empty preparation value and support semantics', () => {
    const a = { id: 1, value: 10 }, b = { id: 2, value: 20 }, fact = {};
    const projection = projections.createEntityEgressProjection(
      [{ subjectId: 1, key: 1, row: a }, { subjectId: 2, key: 2, row: b }],
      undefined, undefined, new Map([['1:m', fact]])
    );
    const before = projection.value();
    const staged = projection.prepare(emptyPacket());
    expect(staged.changed).toBe(false);
    expect(staged.supportEdits).toEqual([]);
    expect(staged.value).toEqual([a, b]);
    expect(staged.value[0]).toBe(a); expect(staged.value[1]).toBe(b);
    installTerminalRecord(staged.record);
    expect(projection.value()).toEqual(before);
    expect([...projection.support()]).toEqual([['1:m', fact]]);
  });

  it.each(['authored-removal', 'equal-value-field', 'empty-field'] as const)(
    'keeps steps-only %s preparation and its exact support update', async kind => {
      const probe = observeProjectionWork(), tree = make(), rows = tree.$.rows;
      rows.addOne({ id: 1, value: 10 }); await flush();
      const connection = link(rows, { set() { /* This control observes the prepared recipient. */ } });
      try {
        const projection = probe.observed[0];
        if (!projection) throw new Error('Expected an enrolled collection projection');
        const subject = inventory(rows).__acquireEntityHandleForTesting(1).subjectId;
        const row = rows.all()[0];
        const oldFact = projection.support().get(`${subject}:f:value`);
        const removal = { subject, before: row, after: undefined, fields: null,
          structural: { kind: 'remove' as const, subject, key: 1, value: row } };
        const field = { subject, before: row, after: row, fields: kind === 'empty-field' ? [] : ['value'] };
        const packet: EntityPublicationPacket = { ...emptyPacket(), steps: [{
          ordinal: 0,
          authoredRemoval: kind === 'authored-removal' ? removal : undefined,
          ordinary: kind === 'authored-removal' ? [] : [field],
        }] };
        probe.reset();
        const source = sourceOf(rows), unit = source.prepare(packet);
        if (!unit) throw new Error('Expected a native publication unit');
        expect(probe.staged).toHaveLength(1);
        const prepared = probe.staged[0].result;
        if (kind === 'empty-field') {
          expect(prepared.supportEdits).toEqual([]);
          expect(prepared.changed).toBe(false);
        } else expect(prepared.supportEdits.length).toBeGreaterThan(0);
        expect(prepared.value).toEqual(kind === 'authored-removal' ? [] : [row]);
        const beforeRevision = source.revision();
        unit.finalize?.(); unit.validate?.(); installTerminalRecord(unit.record);
        source.complete(unit.completion);
        expect(source.revision()).not.toBe(beforeRevision);
        expect(projection.value()).toEqual(kind === 'authored-removal' ? [] : [row]);
        if (kind === 'authored-removal') {
          expect(projection.support().has(`${subject}:f:value`)).toBe(false);
          expect(projection.support().get(`${subject}:m`)).toBeDefined();
        } else {
          const next = projection.support().get(`${subject}:f:value`);
          expect(oldFact).toBeDefined(); expect(next).toBeDefined();
          if (kind === 'empty-field') expect(next).toBe(oldFact);
          else expect(next).not.toBe(oldFact);
        }
      } finally { connection.dispose(); tree.destroy(); await flush(); }
    }
  );

  it('keeps provided order and placement packets on their projection path', async () => {
    const probe = observeProjectionWork(), tree = make(), rows = tree.$.rows;
    rows.setAll([{ id: 1, value: 10 }, { id: 2, value: 20 }]); await flush();
    const connection = link(rows, { set() { /* Exact prepared values are checked below. */ } });
    try {
      const ids = rows.ids().map(key => inventory(rows).__acquireEntityHandleForTesting(key).subjectId);
      const source = sourceOf(rows);
      const cases: readonly Partial<EntityPublicationPacket>[] = [
        { physicalOrder: [] }, { ordinaryOrder: [] },
        { physicalOrder: [...ids].reverse() },
        { ordinaryOrder: [...ids].reverse() },
        { ordinaryPlacements: [{ subject: ids[1], afterSubject: ids[0] }] },
        { ordinaryPlacements: [] },
        { seed: [] },
      ];
      for (const extra of cases) {
        probe.reset();
        const unit = source.prepare({ ...emptyPacket(), ...extra });
        expect(unit).toBeDefined();
        expect(probe.staged).toHaveLength(1);
        if (extra.ordinaryOrder?.length)
          expect(probe.staged[0].result.value).toEqual([{ id: 2, value: 20 }, { id: 1, value: 10 }]);
        else expect(probe.staged[0].result.value).toHaveLength(2);
        // Deliberately do not install these independent drafts into one another.
      }
      expect(rows.all()).toEqual([{ id: 1, value: 10 }, { id: 2, value: 20 }]);
    } finally { connection.dispose(); tree.destroy(); await flush(); }
  });

  it('preserves the nested aggregate preparation path for an empty collection packet', async () => {
    const probe = observeProjectionWork();
    const tree = signalTree({ keep: 7, box: { rows: entityMap<Row, number>() } });
    tree.$.box.rows.setAll([{ id: 1, value: 10 }, { id: 2, value: 20 }]); await flush();
    // Runtime-only aggregate representation control, matching collection-natural-egress.
    // @ts-expect-error marker-bearing aggregates are not a public TruthfulLinkSource
    const connection = link(tree.$, { set() { /* No consequence is changed here. */ } });
    try {
      probe.reset();
      const source = sourceOf(tree.$.box.rows), unit = source.prepare(emptyPacket());
      if (!unit) throw new Error('Expected a nested native publication unit');
      expect(probe.work).toEqual({ emptyPreparations: 1, rowGets: 2 });
      expect(probe.staged[0].result.value).toEqual([{ id: 1, value: 10 }, { id: 2, value: 20 }]);
      unit.finalize?.(); unit.validate?.(); installTerminalRecord(unit.record); source.complete(unit.completion);
      expect(tree.$.keep()).toBe(7);
      expect(tree.$.box.rows.all()).toEqual([{ id: 1, value: 10 }, { id: 2, value: 20 }]);
    } finally { connection.dispose(); tree.destroy(); await flush(); }
  });

  it('installs physical-only latent removal without publishing that removal', async () => {
    const probe = observeProjectionWork(), tree = make(), rows = tree.$.rows;
    const row = { id: 1, value: 10 };
    rows.addOne(row); await flush();
    const deliveries: unknown[] = [];
    const connection = link(rows, { set: value => { deliveries.push(value); } });
    try {
      const projection = probe.observed[0];
      if (!projection) throw new Error('Expected an enrolled collection projection');
      const subject = inventory(rows).__acquireEntityHandleForTesting(1).subjectId;
      const source = sourceOf(rows);
      const unit = source.prepare({ ...emptyPacket(), physical: [{
        subject, before: row, after: undefined, fields: null,
        structural: { kind: 'remove', subject, key: 1, value: row },
      }] });
      if (!unit) throw new Error('Expected a physical publication unit');
      expect(projection.state().topology.has(subject)).toBe(true);
      unit.finalize?.(); unit.validate?.(); installTerminalRecord(unit.record);
      source.complete(unit.completion);
      expect(projection.state().topology.has(subject)).toBe(false);
      expect(projection.value()).toEqual([row]);
      await flush(); await connection.settled();
      expect(deliveries).toEqual([]);
    } finally { connection.dispose(); tree.destroy(); await flush(); }
  });

  it('preserves nested payload getter errors before source installation', async () => {
    const tree = signalTree({ keep: 7, box: { rows: entityMap<Row, number>() } });
    tree.$.box.rows.addOne({ id: 1, value: 10 }); await flush();
    let delivered: object | undefined;
    // Runtime-only aggregate representation, as in collection-natural-egress.
    // @ts-expect-error marker-bearing aggregates are not a public TruthfulLinkSource
    const connection = link(tree.$, { set: value => { delivered = value; } });
    let descriptor: PropertyDescriptor | undefined;
    try {
      tree.$.box.rows.updateOne(1, { value: 11 });
      await flush(); await connection.settled();
      if (!delivered) throw new Error('Expected a useful aggregate delivery');
      descriptor = Object.getOwnPropertyDescriptor(delivered, 'keep');
      expect(descriptor?.value).toBe(7);
      const sentinel = new Error('nested payload getter'), source = sourceOf(tree.$.box.rows);
      const revision = source.revision();
      let hits = 0, caught: unknown;
      Object.defineProperty(delivered, 'keep', { configurable: true, enumerable: true,
        get() { hits++; throw sentinel; } });
      try { source.prepare(emptyPacket()); } catch (error) { caught = error; }
      expect(hits).toBe(1);
      expect(caught).toBe(sentinel);
      expect(source.revision()).toBe(revision);
    } finally {
      if (delivered && descriptor) Object.defineProperty(delivered, 'keep', descriptor);
      connection.dispose(); tree.destroy(); await flush();
    }
  });
});
