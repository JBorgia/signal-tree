import { expect, it, vi } from 'vitest';
import { entityMap, link, signalTree, transactions } from '../index';
import { EntityOrdinaryTopology } from './physical/entity-ordinary-topology';
import { withWriteContext } from './write-context';
const flush = async () => { for (let i=0;i<100;i++) await Promise.resolve(); };
function indexes(owner:object) {
  const d:unknown=Reflect.get(owner,'divergent'),k:unknown=Reflect.get(owner,'displaced');
  if (!(d instanceof Map) || !(k instanceof Map)) throw new Error('Owner index instrumentation unavailable');
  return JSON.stringify({d:[...d],k:[...k],h:Reflect.get(owner,'headOverride'),t:Reflect.get(owner,'tailOverride')});
}
for (const mode of ['throw','reentry'] as const) it(`post-plan owner ${mode} prevents stale outer installation`,async()=>{
  const tree=signalTree({rows:entityMap<{id:string;n:number},string>()},{enhancers:[transactions()]});
  const rows=tree.$.rows;
  const observation=vi.spyOn(EntityOrdinaryTopology.prototype,'prepareInstall');
  const sent:Array<Array<{id:string;n:number}>>=[];
  let connection:ReturnType<typeof link>|undefined;
  try {
    rows.setAll([{id:'a',n:7},{id:'b',n:8}]);await flush();
    const owner=observation.mock.contexts.at(-1);
    if (!(owner instanceof EntityOrdinaryTopology)) throw new Error('No native source owner captured');
    connection=link(rows,{set:value=>{sent.push(structuredClone(value));}});
    const a=rows.byIdOrFail('a');
    withWriteContext({participation:'inspection'},()=>rows.removeOne('b'));await flush();
    const before=indexes(owner);
    observation.mockRestore();
    const original=EntityOrdinaryTopology.prototype.prepareInstall;
    const failure=new Error('injected owner post-plan fault');let entered=false;
    const injection=vi.spyOn(EntityOrdinaryTopology.prototype,'prepareInstall').mockImplementation(function(this: EntityOrdinaryTopology<string>, ordinary,physical){
      const plan=original.call(this,ordinary,physical);
      if(!entered){entered=true;if(mode==='throw')throw failure;a.n(123);}
      return plan;
    });
    try { expect(()=>rows.prependOne({id:'x',n:9})).toThrow(mode==='throw'?failure:/reentered installation/); }
    finally { injection.mockRestore(); }
    expect(entered).toBe(true);expect(rows.ids()).toEqual(['a']);expect(rows.byId('x')).toBeUndefined();
    expect(rows.byIdOrFail('a')).toBe(a);expect(a.n()).toBe(mode==='throw'?7:123);
    expect(indexes(owner)).toBe(before);
    const p=tree.transact(()=>a.n(124));p.rollback();
    expect(a.n()).toBe(mode==='throw'?7:123);
    rows.updateOne('a',{n:mode==='throw'?10:125});await flush();await connection.settled();
    expect(sent.at(-1)).toEqual([{id:'a',n:mode==='throw'?10:125},{id:'b',n:8}]);
  } finally { observation.mockRestore();connection?.dispose();tree.destroy(); }
});
