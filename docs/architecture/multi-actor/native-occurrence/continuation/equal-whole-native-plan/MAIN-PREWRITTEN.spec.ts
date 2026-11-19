import { expect, it } from 'vitest';
import { entityMap, link, signalTree, transactions } from '../index';
import { getPathNotifier } from './path-notifier';
type Declared = ReturnType<typeof link> & { declare(input: {kind: 'independent'}, work: () => void): unknown };
const flush = async () => { getPathNotifier().flushSync(); for(let i=0;i<120;i++) await Promise.resolve(); };
for(const route of ['setAll','replaceOne','row'] as const) for(const owned of [false,true]) {
 it(`approved whole ${route}: ${owned ? 'preserves actual pending owner' : 'refreshes unowned possible-window evidence'}`,async()=>{
  const tree=signalTree({rows:entityMap<{id:string;x:number},string>()},{enhancers:[transactions()]});
  const foreign=signalTree({z:0},{enhancers:[transactions()]});const rows=tree.$.rows;
  rows.addOne({id:'a',x:0});await flush();const row=rows.byIdOrFail('a');
  const sent:unknown[]=[];const connection=link(rows,{set:value=>{sent.push(value);}}) as Declared;
  const q=owned?tree.transact(()=>rows.updateOne('a',{x:7})):foreign.transact(()=>foreign.$.z(7));
  let release=()=>{ /* Assigned after setup, always released in finally. */ };
  try {
   if(!owned)rows.updateOne('a',{x:7});await flush();expect(sent).toEqual([]);
   const before=q.inspect();let notices=0;release=row.x.subscribe(()=>{notices++;});
   connection.declare({kind:'independent'},()=>{
    const supplied={id:'a',x:7};
    if(route==='setAll')rows.setAll([supplied]);else if(route==='replaceOne')rows.replaceOne('a',supplied);else row(supplied);
   });await flush();
   expect(row.x()).toBe(7);expect(notices).toBe(0);expect(q.inspect()).toEqual(before);
   expect(sent).toEqual(owned?[]:[[{id:'a',x:7}]]);
   q.rollback();await flush();expect(row.x()).toBe(owned?0:7);
   expect(sent.at(-1)).toEqual([{id:'a',x:owned?0:7}]);
  } finally {release();connection.dispose();tree.destroy();foreign.destroy();}
 });
}
