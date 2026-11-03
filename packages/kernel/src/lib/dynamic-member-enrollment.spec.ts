import {describe,it,expect} from 'vitest';
import {signalTree,link,transactions} from '../index';
import {withWriteContext} from './write-context';
import {registerMembershipPublication} from './internals/intrinsic-mutation';
const tick=async()=>{for(let i=0;i<100;i++)await Promise.resolve();};
type Row={n:number};
type InstalledRow={n:(value?:number)=>number};
const make=()=>signalTree({rows:{} as Record<string,Row>});
describe('dynamic member enrollment',()=>{
 it('enrolls nested and root recipients independently, then retains omit/readd updates',async()=>{
  const t=make();const root:unknown[]=[];const nested:unknown[]=[];
  const a=link(t.$,{set:v=>{root.push(v);}}),b=link(t.$.rows,{set:v=>{nested.push(v);}});
  try{t.$.rows({a:{n:1}});await tick();expect(nested).toEqual([{a:{n:1}}]);expect(root).toEqual([{rows:{a:{n:1}}}]);
   const held=t.$.rows.a as InstalledRow;t.$.rows({});await tick();expect(nested.at(-1)).toEqual({});
   t.$.rows({a:{n:2}});await tick();expect(t.$.rows.a).toBe(held);held.n(3);await tick();expect(nested.at(-1)).toEqual({a:{n:3}});
  }finally{a.dispose();b.dispose();t.destroy();}
 });
 it('inspection construction stays absent until ordinary whole-member adoption',async()=>{
  const t=make();const sent:unknown[]=[];const l=link(t.$.rows,{set:v=>{sent.push(v);}});
  try{withWriteContext({participation:'inspection'},()=>t.$.rows({a:{n:9},hidden:{n:99}}));await tick();expect(sent).toEqual([]);
   t.$.rows({a:{n:2}});await tick();expect(sent.at(-1)).toEqual({a:{n:2}});(t.$.rows.a as InstalledRow).n(3);await tick();expect(sent.at(-1)).toEqual({a:{n:3}});
  }finally{l.dispose();t.destroy();}
 });
 it('failed preparation leaves no child and retry enrolls once',async()=>{
  const t=make();const sent:unknown[]=[];const l=link(t.$.rows,{set:v=>{sent.push(v);}});const failure=new Error('recipient abort');
  let escaped:object|undefined;
  const off=registerMembershipPublication(edit=>{if(edit.key==='a'){escaped=edit.child;throw failure;}return undefined;},()=>{ /* Intentionally inert fixture hook; the surrounding protocol is asserted. */ });
  try{expect(()=>t.$.rows({a:{n:1}})).toThrow(failure);expect(t.$.rows()).toEqual({});await tick();expect(sent).toEqual([]);off();
   t.$.rows({a:{n:2}});await tick();expect(sent).toEqual([{a:{n:2}}]);(t.$.rows.a as InstalledRow).n(3);await tick();expect(sent).toEqual([{a:{n:2}},{a:{n:3}}]);
   (escaped as {n:(value:number)=>void}).n(999);await tick();expect(sent).toEqual([{a:{n:2}},{a:{n:3}}]);
  }finally{off();l.dispose();t.destroy();}
 });
 it('foreign pending owner holds a newly installed member then rejection releases it',async()=>{
  const foreign=signalTree({x:0},{enhancers:[transactions()]});const t=make();const sent:unknown[]=[];const l=link(t.$.rows,{set:v=>{sent.push(v);}});
  try{const p=foreign.transact(()=>foreign.$.x(1));t.$.rows({a:{n:2}});await tick();expect(sent).toEqual([]);p.rollback();await tick();expect(sent).toEqual([{a:{n:2}}]);await l.settled();
  }finally{l.dispose();t.destroy();foreign.destroy();}
 });
 it('disposal while a new member waits cannot resurrect delivery',async()=>{
  const foreign=signalTree({x:0},{enhancers:[transactions()]});const t=make();const sent:unknown[]=[];const l=link(t.$.rows,{set:v=>{sent.push(v);}});
  try{const p=foreign.transact(()=>foreign.$.x(1));t.$.rows({a:{n:2}});l.dispose();p.rollback();await tick();expect(sent).toEqual([]);(t.$.rows.a as InstalledRow).n(3);await tick();expect(sent).toEqual([]);
  }finally{l.dispose();t.destroy();foreign.destroy();}
 });
 it('reentrant preparation preserves the installed newer identity and rejects stale outer member',async()=>{
  const t=make();const sent:unknown[]=[];const l=link(t.$.rows,{set:v=>{sent.push(v);}});let entered=false;
  const off=registerMembershipPublication(edit=>{if(edit.key==='a'&&!entered){entered=true;t.$.rows({a:{n:7}});}return undefined;},()=>{ /* Intentionally inert fixture hook; the surrounding protocol is asserted. */ });
  try{expect(()=>t.$.rows({a:{n:1}})).toThrow();await tick();expect(t.$.rows()).toEqual({a:{n:7}});expect(sent.at(-1)).toEqual({a:{n:7}});
   (t.$.rows.a as InstalledRow).n(8);await tick();expect(sent.at(-1)).toEqual({a:{n:8}});
  }finally{off();l.dispose();t.destroy();}
 });
 it('disposal during preparation prevents recipient resurrection and leaves retry useful',async()=>{
  const t=make();const sent:unknown[]=[];const l=link(t.$.rows,{set:v=>{sent.push(v);}});
  const off=registerMembershipPublication(edit=>{if(edit.key==='a')l.dispose();return undefined;},()=>{ /* Intentionally inert fixture hook; the surrounding protocol is asserted. */ });
  try{expect(()=>t.$.rows({a:{n:1}})).toThrow();expect(t.$.rows()).toEqual({});off();t.$.rows({a:{n:2}});await tick();expect(sent).toEqual([]);expect(t.$.rows()).toEqual({a:{n:2}});
  }finally{off();l.dispose();t.destroy();}
 });
 it('installed membership completer can immediately author a tracked descendant write',async()=>{
  const t=make();const sent:unknown[]=[];const l=link(t.$.rows,{set:v=>{sent.push(v);}});
  const off=registerMembershipPublication(edit=>edit.key==='a'?{record:{writes:[],adds:[]},completion:{}}:undefined,()=>{(t.$.rows.a as InstalledRow).n(3);});
  try{t.$.rows({a:{n:2}});await tick();expect(t.$.rows()).toEqual({a:{n:3}});expect(sent.at(-1)).toEqual({a:{n:3}});
  }finally{off();l.dispose();t.destroy();}
 });

 it('an authored descendant adopts only its needed inspection-created ancestor path',async()=>{
  const t=make();const sent:unknown[]=[];const l=link(t.$.rows,{set:v=>{sent.push(v);}});
  try{withWriteContext({participation:'inspection'},()=>t.$.rows({a:{n:9},hidden:{n:99}}));await tick();expect(sent).toEqual([]);
   (t.$.rows.a as InstalledRow).n(2);await tick();expect(sent.at(-1)).toEqual({a:{n:2}});
  }finally{l.dispose();t.destroy();}
 });

});
