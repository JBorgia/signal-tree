import { describe, expect, it } from 'vitest';
import { entityMap, leaf, link, signalTree, transactions } from '../index';
import { writeDiagnostic } from '../../test/optional-diagnostic';
import { getEntityPublicationBinding } from './internals/entity-publication';
import * as lifecycle from './experimental-publication/lifecycle';
import { getPathNotifier } from './path-notifier';

type Row = { id: string; value: number };
type Snapshot = { rows: { all: Row[] } };
type Receipt = { read(): Readonly<{ state: string; reason?: string; basis?: string }> };
type DeclaringLink = ReturnType<typeof link> & {
  declare(input: { kind: 'independent' | 'unknown' }, work: () => unknown): Receipt;
};
const flush = async () => {
  getPathNotifier().flushSync();
  for (let n = 0; n < 160; n++) await Promise.resolve();
};
const requirement = (value: object) => value as lifecycle.NativeRequirement;

describe('terminal entity fact representation', () => {
  for (const enrollment of ['none', 'active', 'disposed', 'late'] as const) {
    it(`freezes rejected bulk facts and useful later native consumers: ${enrollment}`, async () => {
      const tree = signalTree({ rows: entityMap<Row, string>() }, { enhancers: [transactions()] });
      const rows = tree.$.rows;
      const source = getEntityPublicationBinding(rows)!.source;
      const outbound: unknown[] = [];
      let connection: ReturnType<typeof link> | undefined;
      const attach = () => link(rows, { set: value => { outbound.push(value); } });
      const owned: Array<{ destroy(): void }> = [];
      const links: ReturnType<typeof link>[] = [];
      const traces: unknown[] = [];
      try {
        if (enrollment === 'active' || enrollment === 'disposed') connection = attach();
        const values = Array.from({ length: 20 }, (_, i) => ({ id: `r${i}`, value: i + 1 }));
        const pending = tree.transact(() => rows.setAll(values));
        const held = rows.byIdOrFail('r0');
        const subject = getEntityPublicationBinding(held)!.subject!;
        const captured = source.captureInput(subject) as { native: readonly lifecycle.NativeInput[] };
        const original = captured.native.map(input => input.requirement);
        const issuedOwners = captured.native.map(input => input.owners);
        const before = tree.$() as Snapshot;
        expect(before.rows.all).toEqual(values);
        await flush();
        expect(outbound).toEqual([]);
        if (enrollment === 'disposed') connection?.dispose();
        pending.rollback();
        await flush();
        const after = tree.$() as Snapshot;
        expect(after.rows.all).toEqual([]);
        expect(held()).toBeUndefined();
        expect(held.value()).toBeUndefined();
        expect(captured.native.map(input => input.requirement)).toEqual(original);
        expect(captured.native.map(input => input.owners)).toEqual(issuedOwners);
        expect(issuedOwners.flat().some(owner => owner.outcome === 'rolled-back')).toBe(true);
        const negative = requirement(source.evidence()!.member(subject, 'ordinary'));
        expect(lifecycle.nativeProof(negative).destination?.some(owner => owner.outcome === 'rolled-back')).toBe(true);
        expect(lifecycle.nativeProof(negative).unknown).toBe(true);
        if (enrollment === 'late') connection = attach();
        await flush();

        for (const input of ['before', 'after', 'current'] as const) {
          for (const declaration of ['independent', 'unknown'] as const) {
            const target = signalTree({ value: -1 });
            owned.push(target);
            const sent: number[] = [];
            const delivery = link(target.$.value, { set: value => { sent.push(value); } }) as DeclaringLink;
            links.push(delivery);
            const snapshot = input === 'before' ? before : after;
            const holder = signalTree({ input: leaf(snapshot) });
            owned.push(holder);
            let calls = 0;
            let receipt: Receipt | undefined;
            let error: unknown;
            try {
              receipt = delivery.declare({ kind: declaration }, () => {
                if (input === 'current') tree.updateAndReport(value => {
                  calls++;
                  target.$.value((value as unknown as Snapshot).rows.all.length);
                  return {};
                });
                else holder.$(value => {
                  calls++;
                  expect(value.input).toBe(snapshot);
                  target.$.value(value.input.rows.all.length);
                  return value;
                });
              });
            } catch (caught) { error = caught; }
            await flush();
            expect(calls).toBe(1);
            expect(target.$.value()).toBe(input === 'before' ? 20 : 0);
            // A contradiction rejects the independence claim. The already
            // installed value still takes the existing surviving fallback.
            expect(sent).toEqual([input === 'before' ? 20 : 0]);
            if (declaration === 'independent') expect(error).toMatchObject({ stage: 'after-callback', reason: 'contradiction' });
            else {
              expect(error).toBeUndefined();
              expect(receipt?.read()).toEqual({ state: 'started', basis: 'surviving' });
            }
            traces.push({ input, declaration, calls, value: target.$.value(), sent, error: error && { stage: (error as { stage?: string }).stage, reason: (error as { reason?: string }).reason }, receipt: receipt?.read() });
          }
        }
        rows.addOne({ id: 'r0', value: 777 });
        rows.changeId('r0', 'moved');
        await flush();
        expect(rows.byIdOrFail('moved').value()).toBe(777);
        expect(held()).toBeUndefined();
        expect(held.value()).toBeUndefined();
        expect(source.evidence()!.member(subject, 'ordinary')).toBe(negative);
        expect(before.rows.all).toEqual(values);
        expect(after.rows.all).toEqual([]);
        expect(outbound).toEqual(enrollment === 'active' ? [[], [{ id: 'r0', value: 777 }]] : enrollment === 'late' ? [[{ id: 'r0', value: 777 }]] : []);
      } finally {
        const directory = process.env['ST_TERMINAL_FACT_TRACE'];
        writeDiagnostic(directory ? `${directory}/${enrollment}.json` : undefined, JSON.stringify({ enrollment, outbound, traces }, null, 2) + '\n');
        for (const c of links) c.dispose();
        connection?.dispose();
        for (const item of owned) item.destroy();
        tree.destroy();
      }
    });
  }

  it('packs exact forgotten tuples while preserving every logical facet and generic support', async () => {
    const tree = signalTree({ rows: entityMap<Row, string>() }, { enhancers: [transactions()] });
    const rows = tree.$.rows, source = getEntityPublicationBinding(rows)!.source;
    const issued: Array<{ subject: number; facts: object[] }> = [];
    const facts = (subject: number) => {
      const evidence = source.evidence()!;
      return [evidence.member(subject, 'ordinary'), evidence.member(subject, 'physical'), evidence.placement(subject, 'physical'), evidence.keyMapping(subject, 'ordinary'), evidence.keyMapping(subject, 'physical')];
    };
    try {
      for (let cycle = 0; cycle < 3; cycle++) {
        const pending = tree.transact(() => rows.setAll(Array.from({ length: 20 }, (_, i) => ({ id: `r${i}`, value: cycle * 100 + i }))));
        const subjects = Array.from({ length: 20 }, (_, i) => getEntityPublicationBinding(rows.byIdOrFail(`r${i}`))!.subject!);
        await flush();
        pending.rollback();
        for (const subject of subjects) issued.push({ subject, facts: facts(subject) });
        const oldPrepared = source.prepare({ owner: 0, id: {}, meta: undefined, physical: [], ordinary: [] })!;
        await flush();
        expect(() => oldPrepared.finalize?.()).toThrow('changed before installation');
        const count = (cycle + 1) * 20;
        expect(source.inspect()).toMatchObject({ presence: count, negativePresence: count, visible: count, negativeVisible: count, mappings: count, mappingViews: count, placementViews: count, packedSubjects: count, packedRuns: cycle + 1, unpackedSubjectFacets: 0, retireCalls: 0, retirementRequests: 0 });
        for (const saved of issued) facts(saved.subject).forEach((fact, index) => expect(fact).toBe(saved.facts[index]));
        expect(source.evidence()!.exclusions?.()).toHaveLength(count);
        // A repeated request cannot count the same logical subject again or
        // treat missing regular-map entries as permission to erase its proof.
        source.requestRetirement(subjects[0], () => true);
        await flush();
        expect(source.inspect()).toMatchObject({ packedSubjects: count, packedRuns: cycle + 1, retireCalls: 0 });
      }
      let generic: lifecycle.NativeRequirement | undefined;
      const off = source.subscribe({
        prepare(_packet, native) {
          generic = (native as { support(): lifecycle.NativeRequirement }).support();
          return undefined;
        },
        complete() { /* Inspection-only test participant owns no completion. */ },
      });
      try { rows.addOne({ id: 'fresh', value: 99 }); } finally { off(); }
      expect(generic).toBeDefined();
      expect(lifecycle.nativeProof(generic!).destination?.filter(owner => owner.outcome === 'rolled-back')).toHaveLength(3);
      expect(rows.all()).toEqual([{ id: 'fresh', value: 99 }]);
    } finally { tree.destroy(); }
  });

  it('preserves closed ownership sets and native contradictions after reverse settlement and new active rows', async () => {
    const tree = signalTree({ rows: entityMap<Row, string>() }, { enhancers: [transactions()] });
    const target = signalTree({ value: -1 });
    const sent: number[] = [];
    const delivery = link(target.$.value, { set: value => { sent.push(value); } }) as DeclaringLink;
    const rows = tree.$.rows, source = getEntityPublicationBinding(rows)!.source;
    try {
      const first = tree.transact(() => rows.setAll([{ id: 'first', value: 1 }]));
      const firstSubject = getEntityPublicationBinding(rows.byIdOrFail('first'))!.subject!;
      const second = tree.transact(() => rows.addOne({ id: 'second', value: 2 }));
      const secondSubject = getEntityPublicationBinding(rows.byIdOrFail('second'))!.subject!;
      await flush();
      second.rollback();
      await flush();
      first.rollback();
      await flush();
      rows.addOne({ id: 'live', value: 3 });
      await flush();
      const captured = source.captureInput() as { native: readonly lifecycle.NativeInput[] };
      const proof = lifecycle.combineProofs(captured.native.map(input => lifecycle.nativeProof(input.requirement)));
      expect(proof.destination?.filter(owner => owner.outcome === 'rolled-back')).toHaveLength(2);
      expect(source.evidence()!.exclusions?.().map(([id]) => id).sort((a, b) => a - b)).toEqual([firstSubject, secondSubject]);
      let calls = 0;
      expect(() => delivery.declare({ kind: 'independent' }, () => tree.updateAndReport(value => {
        calls++;
        expect((value as unknown as Snapshot).rows.all).toEqual([{ id: 'live', value: 3 }]);
        target.$.value(3);
        return {};
      }))).toThrow(expect.objectContaining({ stage: 'after-callback', reason: 'contradiction' }));
      await flush();
      expect(calls).toBe(1);
      expect(sent).toEqual([3]);
    } finally { delivery.dispose(); target.destroy(); tree.destroy(); }
  });
});
