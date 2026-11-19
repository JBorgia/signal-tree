import { writeDiagnostic } from '../../test/optional-diagnostic';
import {expect,it} from 'vitest';
import {link,signalTree,transactions,type PublicationReceipt,type PendingTransaction} from '../index';
const drain=async()=>{for(let i=0;i<160;i++)await Promise.resolve();};
const errorData=(error:unknown)=>error instanceof Error?{name:error.name,message:error.message,...Object.fromEntries(['code','stage','reason','cause'].filter(key=>key in error).map(key=>[key,(error as unknown as Record<string,unknown>)[key]]))}:{thrown:error};
it.each(['A','B'] as const)('approved current-obligation counterpart %s',async(history)=>{
 const output=process.env['ST_TWO_HISTORY_OUTPUT'];
 const tree=signalTree({pair:{x:0,y:0},q:0},{enhancers:[transactions()]});
 const sent:unknown[]=[];const errors:unknown[]=[];const historyReads:unknown[]=[];const freshReads:unknown[]=[];
 const c=link(tree.$.pair,{set:value=>{sent.push(value);}});
 let historical:PublicationReceipt|undefined,fresh:PublicationReceipt|undefined;
 let p!:PendingTransaction,a!:PendingTransaction,b!:PendingTransaction;let settled=false;let settleError:unknown;let notices=0;
 const off=tree.$.pair.x.subscribe(()=>notices++);
 const inspect=(handle:PendingTransaction|undefined)=>{if(!handle)return null;try{return handle.inspect();}catch(error){return {inspectionError:errorData(error)};}};
 const record=(phase:string)=>writeDiagnostic(output,JSON.stringify({history,phase,state:tree.$(),sent,receipts:{historical:historical?.read()??null,fresh:fresh?.read()??null},settled,settleError:settleError??null,notices,historyReads,freshReads,errors,inspection:{p:inspect(p),a:inspect(a),b:inspect(b)}})+'\n',true);
 const admitHistory=(owner:PendingTransaction)=>{
  try{historical=c.declare({kind:'dependent',owners:[p,owner]},()=>tree.$(input=>{
   historyReads.push({q:input.q,x:input.pair.x});
   return {...input,pair:{x:input.q>0?input.pair.x:0,y:input.pair.y}};
  }));}catch(error){errors.push({stage:'historical-admission',error:errorData(error)});}
 };
 try{
  await drain();p=tree.transact(()=>tree.$.pair.x(7));await drain();record('p-pending');
  a=tree.transact(()=>tree.$.q(1));if(history==='A')admitHistory(a);await drain();record('a-pending');
  a.confirm();await drain();record('a-confirmed');
  b=tree.transact(()=>tree.$.q(2));if(history==='B')admitHistory(b);await drain();record('b-pending');
  b.confirm();await drain();record('before-fresh');
  // Establish the matched public workload, not a desired receipt/transport oracle.
  expect(tree.$()).toEqual({pair:{x:7,y:0},q:2});
  expect(historyReads).toEqual([{q:history==='A'?1:2,x:7}]);
  const priorInspection=p.inspect();
  void c.settled().then(()=>{settled=true;},error=>{settleError=errorData(error);});
  try{fresh=c.declare({kind:'dependent',owners:[p,a]},()=>tree.$(input=>{
   freshReads.push({q:input.q,x:input.pair.x});
   return {...input,pair:{x:input.q>0?input.pair.x:0,y:input.pair.y}};
  }));}catch(error){errors.push({stage:'fresh-admission',error:errorData(error)});}
  record('fresh-immediate');await drain();record('fresh-drained');
  expect.soft(fresh?.read()).toEqual({state:'no-write'});
  expect.soft(historical?.read()).toEqual({state:'conservative',reason:'unknown'});
  expect.soft(sent).toEqual([]);expect.soft(settled).toBe(false);
  expect.soft(freshReads).toEqual([{q:2,x:7}]);expect.soft(notices).toBe(1);expect.soft(errors).toEqual([]);
  // Preserve actual ownership; this assertion does not prescribe admission status.
  expect(p.inspect()).toEqual(priorInspection);
  try{p.confirm();}catch(error){errors.push({stage:'p-confirm',error:errorData(error)});}
  await drain();record('p-confirmed');
  expect.soft(historical?.read()).toEqual({state:'started',basis:'surviving'});
  expect.soft(fresh?.read()).toEqual({state:'no-write'});expect.soft(sent).toEqual([{x:7,y:0}]);expect.soft(settled).toBe(true);
  await drain();record('duplicate-drain');expect.soft(sent).toEqual([{x:7,y:0}]);
  c.dispose();await drain();record('disposed');expect.soft(fresh?.read()).toEqual({state:'no-write'});expect.soft(historical?.read()).toEqual({state:'started',basis:'surviving'});expect.soft(sent).toEqual([{x:7,y:0}]);
 }finally{off();c.dispose();tree.destroy();}
});
