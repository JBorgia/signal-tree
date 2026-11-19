import {appendFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {signalTree,entityMap,link,transactions} from '../index';
import {withWriteContext} from './write-context';
import {ordinaryMemberSnapshot} from './internals/plain-branch-membership';
import {getTreeScalarSlotRuntime} from './internals/tree-scalar-slot-port';
import {registerMembershipPublication} from './internals/intrinsic-mutation';
import {diagnostics} from './experimental-publication/private';
const tick=async()=>{for(let i=0;i<120;i++)await Promise.resolve();};
const log=(v:unknown)=>appendFileSync(process.env.ST_PREPARED_REVIEW_OUTPUT+'/diagnostics.jsonl',JSON.stringify(v)+'\n');
for(const operation of ['field','updateOne'] as const)it(`observes ordinary-absent physically-inspected nested collection ${operation} without inventing its oracle`,async()=>{
 const t=signalTree({branch:{rows:entityMap<{id:string;n:number},string>(),s:88},other:0},{enhancers:[transactions()]});const rows=t.$.branch.rows;rows.addOne({id:'a',n:1});const sent:unknown[]=[];const l=link(t.$,{set:v=>sent.push(v)});
 try{t.$({other:1} as Parameters<typeof t.$>[0]);await tick();sent.length=0;
  withWriteContext({participation:'inspection'},()=>rows.addOne({id:'b',n:9}));await tick();const before={physical:t.$(),ordinary:ordinaryMemberSnapshot(t.$),sent:[...sent]};let error:unknown;
  try{if(operation==='field')rows.byIdOrFail('b').n(2);else rows.updateOne('b',{n:2});}catch(e){error=e;}
  await tick();log({case:'ordinary-absent nested entity',operation,before,after:{physical:t.$(),ordinary:ordinaryMemberSnapshot(t.$),sent},error:error instanceof Error?error.message:error});
  expect(before.physical).toBeDefined();
 }finally{l.dispose();t.destroy();}
});

it('diagnoses failed preparation allocations separately from observer registration',async()=>{
 const t=signalTree({rows:{} as Record<string,{n:number}>});const sent:unknown[]=[];const l=link(t.$.rows,{set:v=>sent.push(v)});const rt=getTreeScalarSlotRuntime(t.$)!;const before={slots:rt.slotCount(),listeners:diagnostics().listeners,bindings:diagnostics().latest};const escaped:Array<{n:(value:number)=>void}>=[];const fail=Error('diagnostic preinstall');
 const off=registerMembershipPublication(edit=>{if(edit.key==='a'){escaped.push(edit.child as {n:(value:number)=>void});throw fail;}return undefined;},()=>{});
 try{for(let i=0;i<3;i++)expect(()=>t.$.rows({a:{n:i}})).toThrow(fail);off();const afterFailure={slots:rt.slotCount(),listeners:diagnostics().listeners,bindings:diagnostics().latest};for(const child of escaped)child.n(99);await tick();const afterEscaped=[...sent];t.$.rows({a:{n:2}});await tick();const afterRetry=[...sent];l.dispose();t.$.rows.a.n(3);await tick();log({case:'failed-plan allocation vs registration',before,afterFailure,afterEscaped,afterRetry,afterDispose:sent,slotsAfterRetry:rt.slotCount()});expect(afterEscaped).toEqual([]);expect(afterRetry).toEqual([{a:{n:2}}]);expect(sent).toEqual(afterRetry);
 }finally{off();l.dispose();t.destroy();}
});
