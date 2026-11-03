import assert from 'node:assert/strict';
import {signalTree,entityMap,transactions} from '@signal-tree/kernel';
const output=[];
for(const array of [false,true])for(const mixed of [false,true]){
 const r={array,mixed};output.push(r);const tree=signalTree({scalar:0,rows:entityMap({selectId:()=> 'A'})},{enhancers:[transactions()]});
 try{const value=v=>array?['A',v]:{id:'A',v};tree.$.rows.addOne(value(0));const h=tree.transact(()=>{if(mixed)tree.$.scalar(1);tree.$.rows.replaceOne('A',value(1));});r.inspection=h.inspect();assert.deepEqual(r.inspection.changes.map(c=>c.path).sort(),[array?'rows.A':'rows.A.v',...(mixed?['scalar']:[])].sort());h.rollback();assert.equal(tree.$.scalar(),0);assert.deepEqual(tree.$.rows.all(),[value(0)]);r.status='pass';}catch(e){r.status='fail';r.error=e.stack;process.exitCode=1;}finally{tree.destroy();}
}
console.log(JSON.stringify(output,null,2));
