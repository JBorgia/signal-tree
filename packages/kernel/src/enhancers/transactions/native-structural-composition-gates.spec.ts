import { describe, expect, it } from 'vitest';
import { entityMap, link, signalTree, transactions } from '../../index';
import { withWriteContext } from '../../lib/write-context';
import { getOwnedSubjectIds } from '../../lib/internals/owned-mutation';
import { peekInternalTransactionRuntime } from './transactions';
const tick = async () => { for (let i = 0; i < 100; i++) await Promise.resolve(); };
type Row = { id: string; n: number };
const make = () => signalTree({ x: 0, rows: entityMap<Row, string>() }, { enhancers: [transactions()] });

// These exercise existing contracts: install the complete structural unit
// before callbacks, preserve newer callback selection, keep settlement authority
// coherent, and expose ordinary authored payloads rather than inspected display.
describe('slice2 structural consumer composition gates', () => {
  it('preserves selection C to X to C authored by a structural rollback callback', async () => {
    const tree = make(); let off: (() => void) | undefined;
    try {
      const rows = tree.$.rows; rows.setAll([{id:'a',n:1},{id:'x',n:2}]); rows.setActiveId('a'); await tick();
      const a = rows.byIdOrFail('a');
      const pending = tree.transact(() => { rows.changeId('a','c'); rows.addOne({id:'b',n:3}); });
      expect(rows.activeId()).toBe('c');
      const snapshots: string[][] = []; const selections: Array<string | undefined> = [];
      off = rows.tap({ onRemove: id => {
        if (id !== 'b') return;
        snapshots.push([...rows.ids()]);
        for (const key of ['c','x','c']) { rows.setActiveId(key); selections.push(rows.activeId()); }
      } });
      pending.rollback();
      expect(snapshots).toEqual([['a','x']]); expect(selections).toEqual(['c','x','c']);
      expect(rows.ids()).toEqual(['a','x']); expect(rows.byIdOrFail('a')).toBe(a);
      expect(rows.activeId()).toBe('c'); expect(rows.activeEntity()).toBeUndefined();
      expect(peekInternalTransactionRuntime(tree)!.getPendingTurnCount()).toBe(0);
    } finally { off?.(); tree.destroy(); }
  });

  it('settles an unrelated pending turn during structural rollback delivery after complete installation', async () => {
    const tree = make(); let off: (() => void) | undefined;
    try {
      const rows = tree.$.rows; rows.setAll([{id:'a',n:1},{id:'x',n:2}]); await tick();
      const earlier = tree.transact(() => tree.$.x(8));
      const structural = tree.transact(() => { rows.changeId('a','c'); rows.addOne({id:'b',n:3}); });
      const snapshots: Array<{ ids: string[]; x: number }> = [];
      off = rows.tap({ onRemove: id => {
        if (id !== 'b') return;
        snapshots.push({ids:[...rows.ids()],x:tree.$.x()});
        earlier.rollback();
        snapshots.push({ids:[...rows.ids()],x:tree.$.x()});
      } });
      structural.rollback();
      expect(snapshots).toEqual([{ids:['a','x'],x:8},{ids:['a','x'],x:0}]);
      expect(tree.$.x()).toBe(0); expect(rows.ids()).toEqual(['a','x']);
      expect(peekInternalTransactionRuntime(tree)!.getPendingTurnCount()).toBe(0);
      expect(()=>earlier.rollback()).not.toThrow(); expect(()=>structural.rollback()).not.toThrow();
    } finally { off?.(); tree.destroy(); }
  });

  it('keeps compound inspection membership and order consistent with inspect and ordinary Link rejection', async () => {
    const tree = make(); const sent: Row[][] = []; const rows = tree.$.rows;
    rows.setAll([{id:'a',n:1},{id:'b',n:2},{id:'c',n:3}]); await tick();
    const connection = link(rows, { set: value => { sent.push(structuredClone(value)); } });
    try {
      rows.updateOne('b',{n:4}); await tick(); await connection.settled();
      const baseline = [{id:'a',n:1},{id:'b',n:4},{id:'c',n:3}]; expect(sent.at(-1)).toEqual(baseline);
      const oldA = rows.byIdOrFail('a'), b = rows.byIdOrFail('b');
      withWriteContext({participation:'inspection'},()=>{
        rows.removeOne('a'); rows.addOne({id:'x',n:99});
        rows.setAll([{id:'c',n:3},{id:'b',n:4},{id:'x',n:99}]);
      });
      await tick(); await connection.settled(); expect(sent.at(-1)).toEqual(baseline);
      const x = rows.byIdOrFail('x');
      const pending = tree.transact(()=>rows.setAll([{id:'c',n:3},{id:'a',n:9},{id:'x',n:99}]));
      const freshA = rows.byIdOrFail('a'), changes = pending.inspect().changes;
      for (const row of [oldA,b,x,freshA]) {
        const subject = getOwnedSubjectIds(row.n)![0];
        expect(changes.some(change=>change.subject===subject)).toBe(true);
      }
      pending.rollback(); await tick(); await connection.settled();
      expect(rows.ids()).toEqual(['a','b','c']); expect(rows.byIdOrFail('a')).toBe(oldA); expect(rows.byIdOrFail('b')).toBe(b);
      expect(freshA()).toBeUndefined(); expect(x()).toBeUndefined();
      expect(rows.all()).toEqual(baseline); expect(sent.at(-1)).toEqual(baseline);
      expect(sent.some(value=>value.some(row=>row.id==='x'||row.n===9))).toBe(false);
      rows.updateOne('b',{n:5}); await tick(); await connection.settled();
      expect(sent.at(-1)).toEqual([{id:'a',n:1},{id:'b',n:5},{id:'c',n:3}]);
    } finally { connection.dispose(); tree.destroy(); }
  });
});
