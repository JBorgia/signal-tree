const flush = async () => { for (let i=0;i<60;i++) await Promise.resolve(); };
const copy = value => JSON.parse(JSON.stringify(value));
export const cases = [
 {name:'field independent useful9',kind:'field',foreign:false,dependent:false},
 {name:'row independent useful9',kind:'row',foreign:false,dependent:false},
 {name:'collection independent useful9',kind:'collection',foreign:false,dependent:false},
 {name:'field independent foreign window',kind:'field',foreign:true,dependent:false},
 {name:'collection independent foreign window',kind:'collection',foreign:true,dependent:false},
 {name:'field dependent foreign input',kind:'field',foreign:true,dependent:true},
 {name:'row dependent foreign input',kind:'row',foreign:true,dependent:true},
 {name:'collection dependent foreign input',kind:'collection',foreign:true,dependent:true},
];
export async function runCase(api, test) {
 const observation={name:test.name,route:test.kind,sent:[],phase:'setup'};
 const check=(condition,message)=>{if(!condition)throw Error(message);};
 let tree,q,connection,owner,confirmed=false;
 try {
  tree=api.signalTree({rows:api.entityMap()});
  tree.$.rows.setAll([{id:'r',x:0}]);
  q=api.signalTree({x:0},{enhancers:[api.transactions()]});
  const row=tree.$.rows.byIdOrFail('r');
  const source=test.kind==='field'?row.x:test.kind==='row'?row:tree.$.rows;
  const expected=test.kind==='field'?9:test.kind==='row'?{id:'r',x:9}:[{id:'r',x:9}];
  connection=api.link(source,{set:value=>{observation.sent.push(copy(value));}});
  await flush();observation.sent.length=0;
  if(test.foreign)owner=q.transact(()=>q.$.x(7));
  const before=owner?copy(owner.inspect()):undefined;
  observation.phase='declare';
  const receipt=connection.declare(test.dependent?{kind:'dependent',owners:[owner]}:{kind:'independent'},()=>{
   const value=test.dependent?q.$.x()+2:9;
   if(test.kind==='field')row.x(value);
   else if(test.kind==='row')row({id:'r',x:value});
   else tree.$.rows.setAll([{id:'r',x:value}]);
  });
  observation.receiptAtReturn=copy(receipt.read());
  observation.phase='pre-confirm';await flush();
  observation.receiptBeforeConfirm=copy(receipt.read());observation.sentBeforeConfirm=copy(observation.sent);
  check(row.x()===9,'physical field must be9');
  if(owner){check(q.$.x()===7,'foreign value changed');check(JSON.stringify(owner.inspect())===JSON.stringify(before),'foreign inspection changed');}
  if(test.dependent)check(observation.sent.length===0,'premature dependent publication while foreign owner pending');
  else check(JSON.stringify(observation.sent)===JSON.stringify([expected]),'independent useful9 must deliver exactly once');
  observation.phase='confirm';if(owner){owner.confirm();confirmed=true;}
  await flush();observation.receiptAfterConfirm=copy(receipt.read());
  check(JSON.stringify(observation.sent)===JSON.stringify([expected]),'confirmation must yield exact useful9 once');
  let settled=false;const completion=connection.settled().then(()=>{settled=true;});await flush();
  check(settled,'settled must resolve after useful delivery');await completion;
  await flush();check(observation.sent.length===1,'duplicate delivery');
  check(row.x()===9,'terminal physical state changed');
  observation.settled=true;observation.phase='complete';observation.pass=true;
 } catch(error) {observation.pass=false;observation.error={name:error?.name,message:error?.message,code:error?.code,stage:error?.stage,reason:error?.reason};}
 finally {connection?.dispose();if(owner&&!confirmed){try{owner.confirm();}catch{ /* Best-effort settlement during teardown; retain the original recorded failure. */ }}tree?.destroy();q?.destroy();}
 return observation;
}
