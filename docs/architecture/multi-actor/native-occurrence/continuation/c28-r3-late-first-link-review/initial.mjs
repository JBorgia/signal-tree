import {signalTree, entityMap, transactions} from '@signal-tree/kernel';
const flush=async()=>{for(let i=0;i<60;i++)await Promise.resolve();};
const check=(v,m)=>{if(!v)throw Error(m);};
export async function run(disposition){
 const tree=signalTree({rows:entityMap()},{enhancers:[transactions()]});
 let pending,connection,settled=false;const sent=[];
 try{
  tree.$.rows.setAll([{id:'r',x:0}]);await flush();
  pending=tree.transact(()=>tree.$.rows.updateOne('r',{x:7}));
  check(tree.$.rows.all()[0].x===7,'pending physical7');
  check(pending.inspect().changes.length>0,'populated pending inspection');
  const {attach}=await import('./lazy.mjs');
  connection=attach(tree.$.rows,{set:value=>sent.push(JSON.parse(JSON.stringify(value)))});
  await flush();check(sent.length===0,'late enrollment must hold pending value');
  if(disposition==='confirm')pending.confirm();else pending.rollback();settled=true;
  await flush();const expected=disposition==='confirm'?7:0;
  check(tree.$.rows.all()[0].x===expected,'terminal physical value');
  check(JSON.stringify(sent)===JSON.stringify([[{id:'r',x:expected}]]),'exact useful terminal delivery');
  let done=false;connection.settled().then(()=>{done=true;});await flush();check(done,'settled completion');
  return {disposition,passed:true,sent};
 }finally{connection?.dispose();if(pending&&!settled)pending.confirm();tree.destroy();}
}
