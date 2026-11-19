import { writeDiagnostic } from '../../test/optional-diagnostic';
import {expect,it} from 'vitest';
import {signalTree,link,transactions,entityMap} from '../index';
import {withWriteContext} from './write-context';
import {getPathNotifier} from './path-notifier';
import {registerMembershipPublication} from './internals/intrinsic-mutation';
import {getTreeScalarSlotRuntime} from './internals/tree-scalar-slot-port';
import {diagnostics} from './experimental-publication/private';
const tick=async()=>{getPathNotifier().flushSync();for(let i=0;i<120;i++)await Promise.resolve();};
const log=(v:unknown)=>writeDiagnostic(process.env.ST_PREPARED_REVIEW_OUTPUT ? process.env.ST_PREPARED_REVIEW_OUTPUT+'/independent.jsonl' : undefined,JSON.stringify(v)+'\n',true);
type Declaration=ReturnType<typeof link>&{declare(input:{kind:'independent'}|{kind:'dependent';owners:readonly object[]},work:()=>unknown):unknown};
type Leaf={():number;(v:number):void};
type Row={n:Leaf};

it('deep inspection-created ordinary ancestry adopts only authored descendant path',async()=>{
 const t=signalTree({rows:{} as Record<string,{deep:{x:number;y:number};other:number}>});const sent:unknown[]=[];const l=link(t.$,{set:v=>{sent.push(v);}});
 try{withWriteContext({participation:'inspection'},()=>t.$.rows({a:{deep:{x:9,y:99},other:88},hidden:{deep:{x:77,y:66},other:55}}));await tick();expect(sent).toEqual([]);
  (t.$.rows.a as {deep:{x:Leaf;y:Leaf};other:Leaf}).deep.x(2);await tick();expect(sent.at(-1)).toEqual({rows:{a:{deep:{x:2}}}});
  (t.$.rows.a as {deep:{x:Leaf;y:Leaf};other:Leaf}).deep.x(3);await tick();expect(sent.at(-1)).toEqual({rows:{a:{deep:{x:3}}}});
 }finally{l.dispose();t.destroy();}
});

it('partial installed nested member stays enrolled after later equality failure',async()=>{
 const t=signalTree({trigger:[{x:0}]} as {trigger:{x:number}[];fresh?:{n:number}});const sent:unknown[]=[];const l=link(t.$,{set:v=>{sent.push(v);}});const failure=Error('independent later equality');
 try{expect(()=>(t.$ as unknown as (value:{fresh:{n:number};trigger:{x:number}[]})=>void)({fresh:{n:1},trigger:[{get x():number{throw failure;}}]})).toThrow(failure);await tick();expect(sent).toEqual([{trigger:[{x:0}],fresh:{n:1}}]);
  (t.$.fresh as unknown as Row).n(2);await tick();expect(sent.at(-1)).toEqual({trigger:[{x:0}],fresh:{n:2}});
 }finally{l.dispose();t.destroy();}
});

it('nested installed writer survives rejected outer construction without abandoned registration',async()=>{
 const t=signalTree({rows:{} as Record<string,unknown>,kept:{} as Record<string,number>});const sent:unknown[]=[];const l=link(t.$,{set:v=>{sent.push(v);}});const runtime=getTreeScalarSlotRuntime(t.$)!;const slots=runtime.slotCount();const failure=Error('independent getter abort');
 try{const bad:unknown[]=[];Object.defineProperty(bad,'0',{get(){t.$.kept({saved:7});throw failure;}});
  expect(()=>t.$.rows({lost:{n:1,bad}})).toThrow(failure);await tick();expect(t.$()).toEqual({rows:{},kept:{saved:7}});expect(sent.at(-1)).toEqual(t.$());expect(runtime.slotCount()).toBe(slots+1);
  (t.$.kept.saved as Leaf)(8);await tick();expect(sent.at(-1)).toEqual({rows:{},kept:{saved:8}});
 }finally{l.dispose();t.destroy();}
});

it('repeated omit/readd retains one observable writer and disposal ends delivery',async()=>{
 const t=signalTree({rows:{} as Record<string,{n:number}>});const sent:unknown[]=[];const l=link(t.$.rows,{set:v=>{sent.push(v);}});
 try{t.$.rows({a:{n:1}});await tick();const held=t.$.rows.a as Row;
  for(let i=2;i<5;i++){t.$.rows({});await tick();expect(sent.at(-1)).toEqual({});t.$.rows({a:{n:i}});await tick();expect(t.$.rows.a).toBe(held);const before=sent.length;held.n(i+10);await tick();expect(sent.length).toBe(before+1);expect(sent.at(-1)).toEqual({a:{n:i+10}});}
  const count=sent.length;l.dispose();held.n(100);await tick();expect(sent.length).toBe(count);
 }finally{l.dispose();t.destroy();}
});

it('new member consuming pending source subtree cannot drop its actual owner on omission',async()=>{
 const t=signalTree({rows:{a:{n:0}} as Record<string,{n:number}>});const owner=signalTree({z:0},{enhancers:[transactions()]});const sent:unknown[]=[];const l=link(t.$.rows,{set:v=>{sent.push(v);}}) as Declaration;const q=owner.transact(()=>owner.$.z(7));
 try{l.declare({kind:'dependent',owners:[q]},()=>(t.$.rows.a as Row).n(7));await tick();expect(sent).toEqual([]);
  l.declare({kind:'dependent',owners:[q]},()=>t.$.rows(input=>({b:{n:input.a.n}})));await tick();expect(t.$.rows()).toEqual({b:{n:7}});expect(sent).toEqual([]);q.confirm();await tick();expect(sent).toEqual([{b:{n:7}}]);
 }finally{l.dispose();t.destroy();owner.destroy();}
});

it('repeated preinstall refusal leaves no child observer and no scalar slot growth',async()=>{
 const t=signalTree({rows:{} as Record<string,{n:number}>});const sent:unknown[]=[];const l=link(t.$.rows,{set:v=>{sent.push(v);}});const rt=getTreeScalarSlotRuntime(t.$)!;const slots=rt.slotCount();const before=diagnostics();const escaped:Row[]=[];const failure=Error('independent preinstall');
 const off=registerMembershipPublication(edit=>{if(edit.key==='a'){escaped.push(edit.child as Row);throw failure;}return undefined;},()=>{ /* This refusal probe needs no membership completion work. */ });
 try{for(let i=0;i<3;i++)expect(()=>t.$.rows({a:{n:i}})).toThrow(failure);off();expect(rt.slotCount()).toBe(slots);for(const row of escaped)row.n(99);await tick();expect(sent).toEqual([]);expect(t.$.rows()).toEqual({});expect(diagnostics().listeners).toBe(before.listeners);expect(diagnostics().latest).toBe(before.latest);
  t.$.rows({a:{n:2}});await tick();expect(sent).toEqual([{a:{n:2}}]);log({case:'failed-plan-live-counts',listeners:before.listeners,latest:before.latest,slots});
 }finally{off();l.dispose();t.destroy();}
});

it('real retained collection obeys existing absent named-row refusal and supplied-row readd',async()=>{
 const t=signalTree({branch:{rows:entityMap<{id:string;n:number},string>(),s:99},other:0});const rows=t.$.branch.rows;rows.addOne({id:'a',n:1});const held=rows.byIdOrFail('a');
 try{(t.$ as unknown as (value:{other:number})=>void)({other:1});expect(rows.all()).toEqual([]);expect(()=>held.n(7)).toThrow(/not found/);expect(t.$()).toEqual({other:1});rows.addOne({id:'b',n:2});expect(rows.all()).toEqual([{id:'b',n:2}]);expect(t.$()).toEqual({branch:{rows:{all:[{id:'b',n:2}]}},other:1});}finally{t.destroy();}
});
