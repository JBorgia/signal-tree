import { describe, expect, it } from 'vitest';
import { signalTree, entityMap, transactions } from '../../index';
import { withWriteContext } from '../../lib/write-context';
import { getMutationCaptureRuntime } from '../../lib/internals/mutation-capture-runtime';
import { peekInternalTransactionRuntime } from './transactions';
const tick = async () => { for (let i = 0; i < 40; i++) await Promise.resolve(); };
const inspection = (work: () => void) => withWriteContext({ participation: 'inspection' }, work);
const external = (work: () => void) => withWriteContext({ intent: 'system', participation: 'realized' }, work);
const make = () => signalTree({ rows: entityMap<{id:string;n:number},string>() }, {enhancers:[transactions()]});
describe('ordinary rebind companion chronology', () => {
  for (const direction of ['before', 'after'] as const) {
    it(`orders an independent field write ${direction} adoption, without key-only retimestamp`, async () => {
      const tree=make(), rows=tree.$.rows;
      try {
        rows.setAll([{id:'a',n:7},{id:'b',n:8}]); await tick();
        const a=rows.byIdOrFail('a'); inspection(()=>rows.changeId('a','c'));
        const pending=tree.transact(()=>{
          rows.changeId('b','a');
          if(direction==='before') external(()=>a.n(123));
          a.n(99);
          if(direction==='after') external(()=>a.n(123));
          rows.changeId('c','d'); rows.changeId('d','e');
        });
        const fields=pending.inspect().changes.filter(change=>change.address?.at(-1)==='n');
        expect(fields).toHaveLength(1);
        expect(fields[0].status).toBe(direction==='before'?'current':'superseded');
        pending.confirm();
        expect(peekInternalTransactionRuntime(tree)!.getInspectionFootprintCountsForTesting()).toEqual({writers:0,footprints:0});
      } finally {tree.destroy();}
    });
  }
  it('does not install companion chronology when responsibility preparation fails', async () => {
    const tree=make(), rows=tree.$.rows;
    const runtime=getMutationCaptureRuntime(tree)!;
    const original=runtime.prepareEntityResponsibility;
    const failure=new Error('after prepared responsibility');
    try {
      rows.setAll([{id:'a',n:7},{id:'b',n:8}]); await tick();
      const a=rows.byIdOrFail('a'); inspection(()=>rows.changeId('a','c'));
      let armed=false;
      runtime.prepareEntityResponsibility=capture=>{
        const prepared=original?.(capture);
        if(armed) {armed=false;throw failure;}
        return prepared;
      };
      expect(()=>tree.transact(()=>{rows.changeId('b','a');armed=true;a.n(99);})).toThrow(failure);
      expect(a.n()).toBe(7);
      expect(peekInternalTransactionRuntime(tree)!.getInspectionFootprintCountsForTesting()).toEqual({writers:0,footprints:0});
      runtime.prepareEntityResponsibility=original;
      const next=tree.transact(()=>a.n(12));
      expect(next.inspect().changes.at(-1)?.status).toBe('current');
      next.rollback();expect(a.n()).toBe(7);
    } finally {runtime.prepareEntityResponsibility=original;tree.destroy();}
  });
});
