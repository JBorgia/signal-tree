import { describe, expect, it } from 'vitest';
import { signalTree, entityMap, transactions, restoration, link } from '../index';
import { withWriteContext } from './write-context';
import { undoable } from './undoable';

type Row = { id: string; n: number; m?: number };
const tick = async () => { for (let i = 0; i < 100; i++) await Promise.resolve(); };
const setup = () => {
  const tree = signalTree({ z: 0, rows: entityMap<Row, string>({ selectId: row => row.id }) }, { enhancers: [transactions()] });
  tree.$.rows.setAll([{ id: 'a', n: 7 }, { id: 'b', n: 8 }]);
  return tree;
};
const inspect = (work: () => void) => withWriteContext({ participation: 'inspection' }, work);

describe('shared entity semantic transition — prewritten acceptance', () => {
  it.each(['held-field', 'updateOne'] as const)('A1 %s: setAll preserves two lifetime adoption chronology and ordinary rollback', async route => {
    const tree = setup(); const rows = tree.$.rows; await tick();
    const sent: (readonly Row[])[] = [];
    const connection = link(rows, { set: value => { sent.push(structuredClone(value)); } });
    try {
      inspect(() => {
        if (route === 'held-field') { rows.byIdOrFail('a').n(99); rows.byIdOrFail('b').n(88); }
        else { rows.updateOne('a', { n: 99 }); rows.updateOne('b', { n: 88 }); }
      });
      const pending = tree.transact(() => rows.setAll([{ id: 'a', n: 99, m: 1 }, { id: 'b', n: 88, m: 2 }]));
      // Exact A1 expected facts; archive preserves original run harness verbatim.
      expect(pending.inspect().changes.filter(change => change.path.endsWith('.n')).length).toBe(2);
      pending.rollback(); await tick();
      expect(rows.all()).toEqual([{ id: 'a', n: 7 }, { id: 'b', n: 8 }]);
      expect(sent.some(value => value.some(row => row.n === 99 || row.n === 88))).toBe(false);
      await connection.settled();
      expect(sent.at(-1)).toEqual([{ id: 'a', n: 7 }, { id: 'b', n: 8 }]);
      expect(() => pending.rollback()).not.toThrow();
    } finally { connection.dispose(); tree.destroy(); }
  });

  for (const writer of ['field', 'update', 'replacement', 'setAll'] as const) {
    it(`${writer}: equal displayed value is authored adoption; genuine ordinary equal is not`, () => {
      const tree = setup(); const rows = tree.$.rows; const a = rows.byIdOrFail('a');
      try {
        inspect(() => rows.updateOne('a', { n: 99 }));
        const pending = tree.transact(() => {
          if (writer === 'field') a.n(99);
          if (writer === 'update') rows.updateOne('a', { n: 99 });
          if (writer === 'replacement') a({ id: 'a', n: 99 });
          if (writer === 'setAll') rows.setAll([{ id: 'a', n: 99 }, { id: 'b', n: 8 }]);
        });
        expect(pending.inspect().changes.some(change => change.path.endsWith('.n'))).toBe(true);
        pending.rollback(); expect(a.n()).toBe(7);
        const noop = tree.transact(() => a.n(7));
        expect(noop.inspect().changes).toEqual([]); noop.rollback(); expect(a.n()).toBe(7);
      } finally { tree.destroy(); }
    });
  }

  it('partial adoption leaves inspected sibling outside ordinary responsibility', () => {
    const tree = setup(); const rows = tree.$.rows;
    try {
      inspect(() => rows.updateOne('a', { n: 99, m: 88 }));
      const pending = tree.transact(() => rows.updateOne('a', { n: 99 }));
      expect(pending.inspect().changes.some(change => change.path.endsWith('.m'))).toBe(false);
      pending.rollback();
      expect(rows.byIdOrFail('a').n()).toBe(7);
      expect(rows.byIdOrFail('a')().m).toBe(88);
    } finally { tree.destroy(); }
  });

  it('A1 mixed-throw: outer preparation failure preserves prior baselines for useful rollback', () => {
    const tree = setup(); const rows = tree.$.rows;
    try {
      inspect(() => { rows.updateOne('a', { n: 99 }); rows.updateOne('b', { n: 88 }); });
      const failure = new Error('getter');
      expect(() => tree.transact(() => {
        tree.$.z(1);
        rows.setAll([{ id: 'a', n: 99 }, { id: 'b', get n(): number { throw failure; } }]);
      })).toThrow(failure);
      expect(tree.$.z()).toBe(0);
      expect(rows.all()).toEqual([{ id: 'a', n: 99 }, { id: 'b', n: 88 }]);
      const pending = tree.transact(() => { rows.byIdOrFail('a').n(99); rows.byIdOrFail('b').n(88); });
      pending.rollback();
      expect(rows.all()).toEqual([{ id: 'a', n: 7 }, { id: 'b', n: 8 }]);
    } finally { tree.destroy(); }
  });
  it('repeated writes fold first ordinary-before and last authored-after', () => {
    const tree = setup(); const a = tree.$.rows.byIdOrFail('a');
    try {
      inspect(() => a.n(99));
      const p = tree.transact(() => { a.n(99); a.n(100); });
      expect(p.inspect().changes.some(change => change.path.endsWith('.n'))).toBe(true);
      expect(a.n()).toBe(100); p.rollback(); expect(a.n()).toBe(7);
    } finally { tree.destroy(); }
  });

  it('older overlapping rollback refuses atomically then succeeds newest-open-first', () => {
    const tree = setup(); const a = tree.$.rows.byIdOrFail('a');
    try {
      inspect(() => a.n(99));
      const p = tree.transact(() => a.n(99));
      const q = tree.transact(() => a.n(100));
      expect(() => p.rollback()).toThrow(); expect(a.n()).toBe(100);
      expect(() => p.inspect()).not.toThrow(); expect(() => q.inspect()).not.toThrow();
      q.rollback(); expect(a.n()).toBe(99);
      p.rollback(); expect(a.n()).toBe(7);
      expect(() => p.rollback()).not.toThrow();
    } finally { tree.destroy(); }
  });

  it('preparation reentry retains newer ordinary work instead of stale outer installation', () => {
    const tree = setup(); const rows = tree.$.rows; let entered = false;
    try {
      inspect(() => rows.byIdOrFail('a').n(99));
      try {
        rows.setAll([{ id: 'a', get n() { if (!entered) { entered = true; rows.updateOne('a', { n: 123 }); } return 99; } }, {id: 'b', n: 8}]);
      } catch { /* Existing staging may refuse; the nested authored value must survive. */ }
      expect(entered).toBe(true); expect(rows.byIdOrFail('a').n()).toBe(123);
      expect(rows.byIdOrFail('b').n()).toBe(8);
    } finally { tree.destroy(); }
  });

  for (const flushBeforeUndo of [true]) {
    it(`restoration ordinary adoption is coherent with queued history (flush=${flushBeforeUndo})`, async () => {
      const tree = signalTree({ rows: entityMap<Row, string>({selectId: row => row.id}) }, {enhancers: [restoration()]});
      try {
        tree.$.rows.addOne({id: 'a', n: 7}); await tick();
        inspect(() => tree.$.rows.updateOne('a', {n: 99})); await tick();
        undoable(() => tree.$.rows.updateOne('a', {n: 99}));
        if (flushBeforeUndo) await tick();
        expect(tree.$.rows.byIdOrFail('a').n()).toBe(99);
        tree.undo();
        expect(tree.$.rows.byIdOrFail('a').n()).toBe(7);
        tree.redo();
        expect(tree.$.rows.byIdOrFail('a').n()).toBe(99);
      } finally { tree.destroy(); }
    });
  }

});
