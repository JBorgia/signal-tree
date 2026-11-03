import {expect,it} from 'vitest';
import {signalTree,transactions} from '../index';
import {getPositionRegistry} from './internals/position-registry';
import * as life from './experimental-publication/lifecycle';
const flush=async()=>{for(let i=0;i<30;i++)await Promise.resolve();};
const setup=()=>{const tree=signalTree({x:0},{enhancers:[transactions()]});const pending=tree.transact(()=>tree.$.x(7));const cell=life.pendingOwners().find(c=>c.owner===getPositionRegistry(tree.$)!.id)!;return {tree,pending,cell};};
for(const repeats of [1,3,10])it(`old release cannot erase replacement observer set after ${repeats} repeats`,async()=>{
 const {tree,pending,cell}=setup();const old=life.onOwnerCellTransition(cell,()=>{throw Error('cancelled listener');});old();let first=0,second=0;
 const a=life.onOwnerCellTransition(cell,()=>{first++;}),b=life.onOwnerCellTransition(cell,()=>{second++;});
 try{for(let i=0;i<repeats;i++)old();a();a();pending.confirm();expect([first,second]).toEqual([0,0]);await flush();expect([first,second]).toEqual([0,1]);}finally{old();a();b();tree.destroy();}
});
it('repeated release cancels queued work but preserves a later queued registration',async()=>{
 const {tree,pending,cell}=setup();let stale=0,current=0;const old=life.onOwnerCellTransition(cell,()=>{stale++;});let next=()=>{};
 try{pending.confirm();old();old();next=life.onOwnerCellTransition(cell,()=>{current++;});old();expect([stale,current]).toEqual([0,0]);await flush();expect([stale,current]).toEqual([0,1]);next();next();}finally{old();next();tree.destroy();}
});
it('reentrant self-release may register a successor without reactivating the released observer',async()=>{
 const {tree,pending,cell}=setup();const seen:string[]=[];let next=()=>{};let old=()=>{};
 old=life.onOwnerCellTransition(cell,()=>{seen.push('old');old();next=life.onOwnerCellTransition(cell,()=>{seen.push('next');});old();});
 try{pending.confirm();expect(seen).toEqual([]);await flush();expect(seen).toEqual(['old','next']);old();next();await flush();expect(seen).toEqual(['old','next']);}finally{old();next();tree.destroy();}
});
