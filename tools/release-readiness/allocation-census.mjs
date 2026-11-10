import assert from 'node:assert/strict';
import {loadArm,makeRows,prepareWorkflow,startPending,captureOwnership,startPublication,flush,checkPending,settleWorkflow,retireWorkflow,checkRetired,disposeWorkflow} from '../release-economics/coordinated.mjs';

const factory=await loadArm('packed',process.argv[2]);
const session=factory.create(makeRows(1000));await flush();
const context=prepareWorkflow(session);
const OriginalMap=globalThis.Map;
let constructions=0;
const instrumented=new Proxy(OriginalMap,{construct(target,args,newTarget){
  constructions++;return Reflect.construct(target,args,newTarget===instrumented?target:newTarget);
}});
const counts=[];
const originalConnect=session.connect;
session.connect=(selection,send)=>{
  const before=constructions;const value=originalConnect(selection,send);
  counts.push({phase:`connect-${selection.kind}`,maps:constructions-before});return value;
};
try{
  globalThis.Map=instrumented;
  let before=constructions;startPending(context);counts.push({phase:'start-pending-total',maps:constructions-before});
  globalThis.Map=OriginalMap;captureOwnership(context);
  globalThis.Map=instrumented;before=constructions;startPublication(context);await flush();counts.push({phase:'start-publication-total',maps:constructions-before});
  globalThis.Map=OriginalMap;checkPending(context);
  await settleWorkflow(context);retireWorkflow(context);await flush();checkRetired(context);
  assert.equal(session.rows().length,1000);
  console.log(JSON.stringify({artifact:process.argv[2],instrumented:true,excludedFromTiming:true,counts}));
}finally{globalThis.Map=OriginalMap;disposeWorkflow(context);session.destroy();}
