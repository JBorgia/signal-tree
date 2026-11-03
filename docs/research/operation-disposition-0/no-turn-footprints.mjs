import assert from 'node:assert/strict';
import {signalTree,entityMap,transactions} from '@signal-tree/kernel';
import {peekInternalTransactionRuntime} from '@proof/packages/kernel/src/enhancers/transactions/transactions.ts';
import {getPathNotifier} from '@proof/packages/kernel/src/lib/path-notifier.ts';
const results=[];
for(const kind of ['scalar','entity','mixed','useful-sibling','new-lifetime','add-remove']) for(const settlement of ['confirm','rollback']) {
 const tree=signalTree({x:0,y:0,rows:entityMap()},{enhancers:[transactions()]});
 try {
 tree.$.rows.addOne({id:'a',n:0});getPathNotifier().flushSync();
 const old=tree.transact(()=>{tree.$.x(1);tree.$.rows.updateOne('a',{n:1});});
 const newer=tree.transact(()=>{
 if(['scalar','mixed','useful-sibling'].includes(kind)){tree.$.x(2);tree.$.x(1);}
 if(['entity','mixed','useful-sibling'].includes(kind)){tree.$.rows.updateOne('a',{n:2});tree.$.rows.updateOne('a',{n:1});}
 if(kind==='useful-sibling')tree.$.y(9);
 if(kind==='new-lifetime'){tree.$.rows.removeOne('a');tree.$.rows.addOne({id:'a',n:1});}
 if(kind==='add-remove'){tree.$.rows.addOne({id:'b',n:2});tree.$.rows.removeOne('b');}
 });
 const runtime=peekInternalTransactionRuntime(tree);const before={pending:runtime.getPendingTurnCount(),older:old.inspect().changes,newer:newer.inspect().changes};
 let error;try {newer[settlement]();}catch(e){error=String(e);}
 const after={pending:runtime.getPendingTurnCount(),older:old.inspect().changes,x:tree.$.x(),y:tree.$.y(),rows:tree.$.rows.all()};
 assert.equal(tree.$.x(),1);assert.equal(tree.$.y(),kind==='useful-sibling'&&settlement==='confirm'?9:0);
 results.push({kind,settlement,before,after,error});
 }finally{tree.destroy();}
}
console.log(JSON.stringify(results,null,2));
