import assert from 'node:assert/strict';
import {signalTree,entityMap,transactions} from '@signal-tree/kernel';
const runs=[];
for(const [N,k] of [[128,1],[128,8],[128,32],[128,128],[1024,8],[8192,8]]) for(const kind of ['scalar','same-row','distinct-rows']) for(const settlement of ['confirm','rollback']) {
 const tree=signalTree({n:0,rows:entityMap()},{enhancers:[transactions()]});
 try {
  tree.$.rows.setAll(Array.from({length:N},(_,i)=>({id:String(i),n:0})));
  const phases={capture:{},settlement:{}};let phase='capture';
  globalThis.__work=(key,n=1)=>{phases[phase][key]=(phases[phase][key]??0)+n};
  const pending=tree.transact(()=>{for(let i=0;i<k;i++) if(kind==='scalar')tree.$.n(i+1);else tree.$.rows.updateOne(kind==='same-row'?'0':String(i),{n:i+1});});
  delete globalThis.__work;
  assert.equal(kind==='scalar'?tree.$.n():tree.$.rows.byIdOrFail(kind==='same-row'?'0':String(k-1)).n(),k);
  phase='settlement';globalThis.__work=(key,n=1)=>{phases[phase][key]=(phases[phase][key]??0)+n};
  pending[settlement]();delete globalThis.__work;
  assert.equal(kind==='scalar'?tree.$.n():tree.$.rows.byIdOrFail(kind==='same-row'?'0':String(k-1)).n(),settlement==='rollback'?0:k);
  assert.equal(tree.$.rows.count(),N);
  runs.push({N,k,kind,settlement,phases});
 }finally {delete globalThis.__work;tree.destroy();}
}
console.log(JSON.stringify({limits:'Counts only the named instrumented source seams; no elapsed-time or total-work claim. Seeding, reads and destruction excluded.',runs},null,2));
