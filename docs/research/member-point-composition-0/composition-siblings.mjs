import assert from 'node:assert/strict';
import {createRoot,createComputed} from 'solid-js';
import {createSignalTreeFactory} from '@signal-tree/kernel/adapter';
import {entityMap,transactions} from '@signal-tree/kernel';
import {createSolidObservationAdapter} from '@proof/packages/solid/src/lib/solid-observation.ts';
import {peekInternalTransactionRuntime} from '@proof/packages/kernel/src/enhancers/transactions/transactions.ts';
import {hasOpenCommitScope} from '@proof/packages/kernel/src/lib/internals/commit-consequence.ts';
// Separate dependency-chain probe: two changed branches, two scalar slots per
// branch, and a held collection inside a changed member. Original ten untouched.
const mode=process.argv[2]??'control';
const target=mode.startsWith('fault-')?mode.split('-')[1]:undefined;
const marker=mode.endsWith('undefined')?undefined:Error('after real writable token');
const trace={mode,tokens:{member:[],row:[],scalar:[]},hits:0,taps:0,seen:[],checks:[]};
let tree,stop,untap,phase='setup',label,armed=false,id=0;
const base=createSolidObservationAdapter();
const adapter={...base,createWritableCell(read){const r=base.createWritableCell(read),n=++id;return {...r,cell:new Proxy(r.cell,{apply(t,s,a){if(label&&!trace.tokens[label].includes(n))trace.tokens[label].push(n);return Reflect.apply(t,s,a);}}),token:{observe(){r.token.observe();},invalidate(){r.token.invalidate();if(armed&&!trace.hits&&trace.tokens[target]?.includes(n)){trace.hits++;trace.stack=new Error().stack;throw marker;}}}};}};
const check=(name,fn)=>{try{fn();trace.checks.push({name,pass:true});}catch(e){trace.checks.push({name,pass:false,error:e.stack});process.exitCode=1;}};
const attempt=fn=>{try{fn();return {threw:false};}catch(e){return {threw:true,exact:e===marker,undefined:e===undefined,message:e?.message,code:e?.code};}};
try{
 tree=createSignalTreeFactory(adapter)({count:100,left:{x:200,y:201},right:{x:400,y:401,rows:entityMap()}},{enhancers:[transactions()]});
 const rows=tree.$.right.rows;rows.addOne({id:'A',v:300});rows.setActiveId('A');const held=rows.byIdOrFail('A');
 label='member';tree.$.left.x();label='scalar';tree.$.count();label='row';held.v();rows.all();label=undefined;
 const read=()=>structuredClone({snapshot:tree.$(),keys:Object.keys(tree.$()).sort(),left:tree.$.left(),right:tree.$.right(),count:tree.$.count(),lx:tree.$.left.x(),ly:tree.$.left.y(),rx:tree.$.right.x(),ry:tree.$.right.y(),ids:[...rows.ids()],all:rows.all().map(x=>({...x})),held:held(),activeId:rows.activeId(),active:rows.activeEntity()});
 trace.before=read();stop=createRoot(off=>{createComputed(()=>trace.seen.push({phase,value:read()}));return off;});
 untap=rows.tap({onRemove(){if(phase==='rollback'&&mode==='callback'&&!trace.taps){trace.taps++;tree.$.count.set(777);tree.$.left.y.set(778);rows.updateOne('A',{v:779});}}});
 phase='authored';const pending=tree.transact(()=>{tree.$.count.set(101);tree.$.left.x.set(202);tree.$.right.y.set(402);rows.addOne({id:'B',v:301});tree.$({count:101});});
 trace.speculative=read();check('useful omission and authority',()=>{assert.deepEqual(trace.speculative.keys,['count']);assert.equal(peekInternalTransactionRuntime(tree).getPendingTurnCount(),1);});
 phase='rollback';armed=!!target;trace.rollback=attempt(()=>pending.rollback());armed=false;trace.after=read();trace.pending=peekInternalTransactionRuntime(tree).getPendingTurnCount();trace.scope=hasOpenCommitScope(tree);
 let expected=trace.before;
 check('exact result',()=>{assert.equal(trace.rollback.threw,!!target);if(target){assert.equal(trace.hits,1);assert.equal(trace.rollback.exact,true);}});
 if(mode==='callback'){expected=structuredClone(trace.before);expected.count=777;expected.ly=778;expected.left.y=778;expected.snapshot.count=777;expected.snapshot.left.y=778;expected.all[0].v=779;expected.held.v=779;expected.active.v=779;expected.right.rows.all[0].v=779;expected.snapshot.right.rows.all[0].v=779;}
 check('final disposition and lifetime',()=>{assert.deepEqual(trace.after,expected);assert.equal(rows.byIdOrFail('A'),held);assert.equal(rows.byId('B'),undefined);assert.equal(trace.pending,0);assert.equal(trace.scope,false);if(mode==='callback')assert.equal(trace.taps,1);});
 check('every actual delivery coherent',()=>{const frames=trace.seen.filter(x=>x.phase==='rollback');assert.ok(frames.length);for(const f of frames)assert.deepEqual(f.value,expected);});
 phase='retry';trace.retry=attempt(()=>pending.rollback());check('terminal retry inert',()=>{assert.equal(trace.retry.threw,false);assert.deepEqual(read(),expected);});
}catch(e){trace.unexpected=e.stack;process.exitCode=1;}finally{armed=false;untap?.();stop?.();tree?.destroy();base.dispose?.();}
console.log(JSON.stringify(trace,null,2));
