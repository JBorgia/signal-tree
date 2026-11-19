import { expect, it } from 'vitest';
import { signalTree, entityMap, transactions, link } from '../index';
it('late consumer preserves earlier ordinary history with foreign confirmation and rollback separately', async () => {
  const flush = async () => { for (let i=0;i<160;i++) await Promise.resolve(); };
  async function scenario(settlement: 'confirm'|'rollback') {
    const tree=signalTree({rows:entityMap<{id:string;x:number;y:number},string>()});
    const foreign=signalTree({z:0},{enhancers:[transactions()]});
    tree.$.rows.setAll([{id:'a',x:0,y:0}]);
    const q=foreign.transact(()=>foreign.$.z(7));
    const beforeOwner=q.inspect();const sent: unknown[]=[];
    let consumer: ReturnType<typeof link>|undefined;
    try {
      tree.$.rows.updateOne('a',{x:7});
      expect(tree.$.rows.byIdOrFail('a')().x).toBe(7);
      consumer=link(tree.$.rows,{set:value=>{sent.push(value);}});
      consumer.declare({kind:'independent'},()=>tree.$.rows.updateOne('a',{y:8}));
      await flush();const before=sent.slice();
      expect(q.inspect()).toEqual(beforeOwner);
      q[settlement]();await flush();const settled=sent.slice();
      expect(tree.$.rows.byIdOrFail('a')()).toEqual({id:'a',x:7,y:8});
      consumer.declare({kind:'independent'},()=>tree.$.rows.updateOne('a',{x:9,y:10}));
      await flush();await consumer.settled();
      expect(sent.at(-1)).toEqual([{id:'a',x:9,y:10}]);
      const final=sent.slice();await flush();expect(sent).toEqual(final);
      consumer.dispose();let called=false;
      expect(()=>consumer?.declare({kind:'independent'},()=>{called=true;})).toThrow();expect(called).toBe(false);
      return {settlement,before,settled,final};
    } finally {consumer?.dispose();tree.destroy();foreign.destroy();}
  }
  for(const settlement of ['confirm','rollback'] as const){
    const baseline=await scenario(settlement);
    expect(baseline.before).toEqual([]);
    expect(baseline.settled).toEqual([[{id:'a',x:7,y:8}]]);
  }
});
