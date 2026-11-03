const flush=async()=>{for(let i=0;i<60;i++)await Promise.resolve();};
const copy=v=>JSON.parse(JSON.stringify(v));
const check=(v,m)=>{if(!v)throw Error(m);};
export const lifecycleCases=[];
for(const kind of ['field','collection'])for(const terminal of ['confirm','rollback'])lifecycleCases.push({name:`pre-Link pending ${kind} ${terminal}`,kind,terminal,late:false});
for(const terminal of ['confirm','rollback'])lifecycleCases.push({name:`late collection multiple Links ${terminal}`,kind:'collection',terminal,late:true});
export async function runLifecycle(api,test){
 const r={name:test.name,sent:[],second:[],third:[],phase:'setup'};let tree,pending,settled=false;const links=[];
 try{
  // API module has already evaluated; none of these trees/collections existed then.
  tree=api.signalTree({rows:api.entityMap()},{enhancers:[api.transactions()]});
  tree.$.rows.setAll([{id:'r',x:0}]);await flush();const row=tree.$.rows.byIdOrFail('r');
  if(test.late){
   links.push(api.link(tree.$.rows,{set:v=>r.sent.push(copy(v))}));
   links.push(api.link(row,{set:v=>r.second.push(copy(v))}));
   links.push(api.link(row.x,{set:v=>r.third.push(copy(v))}));
   await flush();r.sent.length=0;r.second.length=0;r.third.length=0;
  }
  pending=tree.transact(()=>row.x(7));const inspection=copy(pending.inspect());
  if(!test.late)links.push(api.link(test.kind==='field'?row.x:tree.$.rows,{set:v=>r.sent.push(copy(v))}));
  r.phase='pending';await flush();check(r.sent.length===0&&r.second.length===0&&r.third.length===0,'must hold while actual owner pending');
  check(row.x()===7,'pending physical7');check(JSON.stringify(pending.inspect())===JSON.stringify(inspection),'Link enrollment changed pending inspection');
  r.phase=test.terminal;pending[test.terminal]();settled=true;await flush();let x=test.terminal==='confirm'?7:0;
  if(!test.late&&test.terminal==='confirm'){
   // Enrollment adopts current value; confirmation alone is not an initial send.
   check(r.sent.length===0,'confirmation of adopted baseline is not a new value write');
   links[0].declare({kind:'independent'},()=>row.x(9));await flush();x=9;
  }
  const expected=test.kind==='field'?x:[{id:'r',x}];
  check(JSON.stringify(r.sent)===JSON.stringify([expected]),'useful terminal output exactly once');
  if(test.late)check(JSON.stringify(r.second)===JSON.stringify([{id:'r',x}]),'second Link useful terminal output exactly once');
  if(test.late)check(JSON.stringify(r.third)===JSON.stringify([x]),'field Link useful terminal output exactly once');
  check(row.x()===x,'terminal physical state');
  for(const link of links){let done=false;const promise=link.settled().then(()=>{done=true;});await flush();check(done,'settled resolves');await promise;}
  await flush();check(r.sent.length===1&&(!test.late||r.second.length===1&&r.third.length===1),'no duplicate terminal output');r.pass=true;r.phase='complete';
 }catch(error){r.pass=false;r.error={name:error?.name,message:error?.message};}
 finally{for(const link of links)link.dispose();if(pending&&!settled){try{pending.confirm();}catch{ /* Best-effort settlement during teardown; retain the original recorded failure. */ }}tree?.destroy();}
 return r;
}
