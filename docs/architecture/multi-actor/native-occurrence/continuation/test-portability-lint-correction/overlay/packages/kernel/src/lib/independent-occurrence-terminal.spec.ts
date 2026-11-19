import { writeDiagnostic } from '../../test/optional-diagnostic';
import {expect,it} from 'vitest';
import {signalTree,link,transactions,entityMap} from '../index';
import {getPathNotifier} from './path-notifier';
type Declaration=ReturnType<typeof link>&{declare(input:{kind:'independent'}|{kind:'dependent';owners:readonly object[]},work:()=>unknown):unknown};
const tick=async()=>{getPathNotifier().flushSync();for(let i=0;i<120;i++)await Promise.resolve();};
for(const kind of ['scalar','empty','collection','mixed'] as const)for(const outcome of ['confirm','rollback'] as const)it(`undeclared child ${kind} useful absence after ${outcome}`,async()=>{
 const t=signalTree({branch:{rows:entityMap<{id:string;x:number},string>(),x:0},other:0},{enhancers:[transactions()]});const owner=signalTree({z:0},{enhancers:[transactions()]});if(kind!=='empty')t.$.branch.rows.addOne({id:'a',x:0});await tick();
 const rootSent:unknown[]=[],childSent:unknown[]=[];const root=link(t.$ as unknown as (()=>{other:number;branch?:unknown}),{set:v=>{rootSent.push(v);}}) as Declaration;const child=link((kind==='scalar'?t.$.branch.x:kind==='mixed'?t.$.branch:t.$.branch.rows) as never,{set:(v:unknown)=>{childSent.push(v);}});const q=owner.transact(()=>owner.$.z(7));
 try{root.declare({kind:'dependent',owners:[q]},()=>kind==='scalar'?t.$.branch.x(7):kind==='empty'?t.$.branch.rows.addOne({id:'a',x:7}):t.$.branch.rows.updateOne('a',{x:7}));await tick();expect(rootSent).toEqual([]);
  root.declare({kind:'independent'},()=>(t.$ as unknown as (value:{other:number})=>void)({other:1}));await tick();expect(rootSent).toEqual([{other:1}]);const immediate=[...childSent];q[outcome]();await tick();
  writeDiagnostic(process.env.ST_PREPARED_REVIEW_OUTPUT ? process.env.ST_PREPARED_REVIEW_OUTPUT+'/terminal.jsonl' : undefined,JSON.stringify({kind,outcome,immediate,terminal:childSent,root:rootSent})+'\n',true);
  expect(childSent).toEqual([kind==='empty'||kind==='collection'?[]:undefined]);
 }finally{root.dispose();child.dispose();t.destroy();owner.destroy();}
});
