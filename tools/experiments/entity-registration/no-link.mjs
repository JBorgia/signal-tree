import {signalTree,entityMap,transactions} from '@signal-tree/kernel';
const check=(v,m)=>{if(!v)throw Error(m);};
const t=signalTree({rows:entityMap()},{enhancers:[transactions()]});
try{
 t.$.rows.setAll([{id:'r',x:0}]);const row=t.$.rows.byIdOrFail('r');
 const first=t.transact(()=>row.x(7));check(row.x()===7,'pending7');check(first.inspect().changes.length>0,'first actual inspection contribution');
 first.confirm();check(row.x()===7,'confirmed7');
 const second=t.transact(()=>row.x(9));check(row.x()===9,'pending9');check(second.inspect().changes.length>0,'second actual inspection contribution');
 second.rollback();check(row.x()===7,'rollback7');check(JSON.stringify(t.$.rows.all())===JSON.stringify([{id:'r',x:7}]),'whole collection rollback7');
 console.log(JSON.stringify({scope:'separate production no-Link entity transactions',confirmed:7,rolledBack:7,passed:true}));
}finally{t.destroy();}
