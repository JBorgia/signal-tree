import { describe, expect, it } from 'vitest';
import { entityMap, link, signalTree, transactions } from '../index';
import { withWriteContext } from './write-context';
import { createEntityEgressProjection } from './internals/entity-egress-projection';
import type { EntityPublicationEvidence } from './internals/entity-publication';

type Row = { id: string; n: number };
const flush = async () => { for (let i = 0; i < 120; i++) await Promise.resolve(); };
const seed = [{ id: 'a', n: 1 }, { id: 'b', n: 2 }];
const added = [{ id: 'x', n: 3 }, { id: 'y', n: 4 }];
const make = () => signalTree({ rows: entityMap<Row, string>() }, { enhancers: [transactions()] });

describe('completed fresh prepend publication', () => {
  it.each(['ordinary', 'confirm', 'rollback'] as const)('preserves exact collection order after %s', async mode => {
    const tree = make();
    tree.$.rows.setAll(seed);
    const sent: Row[][] = [];
    const connection = link(tree.$.rows, { set: value => { sent.push(value); } });
    try {
      if (mode === 'ordinary') tree.$.rows.prependMany(added);
      else {
        const pending = tree.transact(() => tree.$.rows.prependMany(added));
        expect(tree.$.rows.ids()).toEqual(['x', 'y', 'a', 'b']);
        await flush(); expect(sent).toEqual([]);
        pending[mode]();
      }
      await flush(); await connection.settled();
      expect(sent.at(-1)).toEqual(mode === 'rollback' ? seed : [...added, ...seed]);
      const retained = sent.at(-1);
      tree.$.rows.updateOne('a', { n: 99 });
      await flush(); await connection.settled();
      expect(retained?.find(row => row.id === 'a')?.n).toBe(1);
      expect(sent.at(-1)?.find(row => row.id === 'a')?.n).toBe(99);
    } finally { connection.dispose(); tree.destroy(); }
  });

  it('retains early and late recipients own membership across inspection removal', async () => {
    const tree = make();
    tree.$.rows.setAll(seed);
    const early: Row[][] = [], late: Row[][] = [];
    const first = link(tree.$.rows, { set: value => { early.push(value); } });
    let second: ReturnType<typeof link> | undefined;
    try {
      withWriteContext({ participation: 'inspection' }, () => tree.$.rows.removeOne('a'));
      await flush(); expect(early).toEqual([]);
      second = link(tree.$.rows, { set: value => { late.push(value); } });
      tree.$.rows.prependMany(added);
      await flush(); await Promise.all([first.settled(), second.settled()]);
      expect(tree.$.rows.ids()).toEqual(['x', 'y', 'b']);
      expect(early.at(-1)).toEqual([seed[0], ...added, seed[1]]);
      expect(late.at(-1)).toEqual([...added, seed[1]]);
    } finally { second?.dispose(); first.dispose(); tree.destroy(); }
  });

  it('keeps foreign pending obligations through late enrollment', async () => {
    const tree = make(), foreign = signalTree({ n: 0 }, { enhancers: [transactions()] });
    tree.$.rows.setAll(seed);
    const pending = foreign.transact(() => foreign.$.n(1));
    const sent: Row[][] = [];
    let connection: ReturnType<typeof link> | undefined;
    try {
      tree.$.rows.prependMany(added);
      connection = link(tree.$.rows, { set: value => { sent.push(value); } });
      connection.declare({ kind: 'independent' }, () => tree.$.rows.updateOne('a', { n: 99 }));
      await flush(); expect(sent).toEqual([]);
      pending.confirm(); await flush(); await connection.settled();
      expect(sent.at(-1)).toEqual([...added, { id: 'a', n: 99 }, seed[1]]);
    } finally { pending.confirm(); connection?.dispose(); tree.destroy(); foreign.destroy(); }
  });

  it('keeps payload and support chronology across a nonstructural edit between dependent additions', () => {
    const projection = createEntityEgressProjection([{ subjectId: 1, key: 'a', row: seed[0] }]);
    const changes = [
      { subject: 2, before: undefined, after: added[0], fields: null, structural: { kind: 'add' as const, subject: 2, key: 'x', value: added[0], afterSubject: 3 } },
      { subject: 2, before: added[0], after: { id: 'x', n: 99 }, fields: ['n'] },
      { subject: 3, before: undefined, after: added[1], fields: null, structural: { kind: 'add' as const, subject: 3, key: 'y', value: added[1], beforeSubject: 2, afterSubject: 1 } },
    ];
    const seen: number[] = [];
    const fact = {};
    const evidence: EntityPublicationEvidence = {
      member: () => fact, field: () => fact, placement: () => fact, keyMapping: () => fact,
      forEdit: edit => { seen.push(edit.subject); return evidence; },
    };
    const prepared = projection.prepare({ owner: 0, id: {}, meta: undefined, physical: changes, ordinary: changes }, evidence);
    expect(prepared.value).toEqual([{ id: 'x', n: 99 }, added[1], seed[0]]);
    expect(seen).toEqual([2, 2, 3]);
    expect(projection.value()).toEqual([seed[0]]);
  });

  it('keeps removed and rekeyed lifetimes distinct from later same-key additions', () => {
    const oldA = { id: 'old-a', n: 1 }, oldX = { id: 'old-x', n: 2 };
    const newX = { id: 'new-x', n: 3 }, newA = { id: 'new-a', n: 4 };
    const projection = createEntityEgressProjection([{ subjectId: 1, key: 'a', row: oldA }]);
    const changes = [
      { subject: 2, before: undefined, after: oldX, fields: null, structural: { kind: 'add' as const, subject: 2, key: 'x', value: oldX, afterSubject: 1 } },
      { subject: 2, before: oldX, after: undefined, fields: null, structural: { kind: 'remove' as const, subject: 2, key: 'x', value: oldX, afterSubject: 1 } },
      { subject: 3, before: undefined, after: newX, fields: null, structural: { kind: 'add' as const, subject: 3, key: 'x', value: newX, afterSubject: 1 } },
      { subject: 1, before: oldA, after: oldA, fields: null, structural: { kind: 'rekey' as const, subject: 1, beforeKey: 'a', afterKey: 'b' } },
      { subject: 4, before: undefined, after: newA, fields: null, structural: { kind: 'add' as const, subject: 4, key: 'a', value: newA, afterSubject: 1 } },
    ];
    const prepared = projection.prepare({ owner: 0, id: {}, meta: undefined, physical: changes, ordinary: changes });
    expect(prepared.value).toEqual([newX, newA, oldA]);
    expect(prepared.value).not.toContain(oldX);
    expect(projection.value()).toEqual([oldA]);
  });
});
