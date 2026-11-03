import {expect,it,vi} from 'vitest';
import {link,signalTree,transactions} from '../index';
import {getPathNotifier} from './path-notifier';
import {getTreeScalarSlotRuntime} from './internals/tree-scalar-slot-port';
import {getOwnedPositionIds} from './internals/owned-mutation';
import {preparePublicationMutations} from './internals/intrinsic-mutation';
import {RecipientOccurrences} from './experimental-publication/recipient-occurrence';
import * as pub from './experimental-publication/private';
import * as life from './experimental-publication/lifecycle';
type C=ReturnType<typeof link>&{declare(d:{kind:'independent'}|{kind:'dependent';owners:readonly object[]},work:()=>unknown):unknown};
type Receipt=NonNullable<ReturnType<typeof pub.refreshSource>>&{workEpoch:number};
const read=(channel:object)=>pub.refreshSource(channel) as Receipt|undefined;
const ack=(channel:object,receipt:Receipt)=>{const fn=(pub as unknown as {acknowledgeProjection?:(channel:object,r:Receipt)=>void}).acknowledgeProjection;expect(fn).toBeTypeOf('function');fn!(channel,receipt);};
const flush=async()=>{getPathNotifier().flushSync();for(let i=0;i<120;i++)await Promise.resolve();};
function fixture(){const t=signalTree({a:0,b:0},{enhancers:[transactions()]}),foreign=signalTree({z:0},{enhancers:[transactions()]});const sent:unknown[]=[];const c=link(t.$,{set:v=>{sent.push(v);}}) as C;const q=foreign.transact(()=>foreign.$.z(7));return {t,foreign,c,q,sent,dispose(){c.dispose();q.confirm();t.destroy();foreign.destroy();}};}
for(const reverse of [false,true])it(`private sibling frame carries value work reverse=${reverse}`,async()=>{const s=fixture();try{const r=getTreeScalarSlotRuntime(s.t.$)!,f=r.beginFrame();for(const key of (reverse?['b','a']:['a','b']) as ('a'|'b')[])f.set(r.resolveScalarSlot(getOwnedPositionIds(s.t.$[key])![0])!,key==='a'?1:0);f.commit();s.q.confirm();await flush();expect(s.sent).toEqual([{a:1,b:0}]);}finally{s.dispose();}});
it('public changed A then equal dependent B preserves work under current pending support',async()=>{const s=fixture();try{s.c.declare({kind:'independent'},()=>s.t.$.a(1));s.c.declare({kind:'dependent',owners:[s.q]},()=>s.t.$.b(0));await flush();expect(s.t.$()).toEqual({a:1,b:0});expect(s.sent).toEqual([]);s.q.confirm();await flush();expect(s.sent).toEqual([{a:1,b:0}]);await s.c.settled();}finally{s.dispose();}});
it('already delivered A then equal dependent B does not rearm value work',async()=>{const s=fixture();try{s.c.declare({kind:'independent'},()=>s.t.$.a(1));await flush();expect(s.sent).toEqual([{a:1,b:0}]);s.c.declare({kind:'dependent',owners:[s.q]},()=>s.t.$.b(0));await flush();expect(s.sent).toEqual([{a:1,b:0}]);s.q.confirm();await flush();expect(s.sent).toEqual([{a:1,b:0}]);s.t.$.a(2);await flush();expect(s.sent).toEqual([{a:1,b:0},{a:2,b:0}]);}finally{s.dispose();}});
it('equal-only private frame does not invent value work',async()=>{const s=fixture();try{const r=getTreeScalarSlotRuntime(s.t.$)!,f=r.beginFrame();f.set(r.resolveScalarSlot(getOwnedPositionIds(s.t.$.a)![0])!,0);f.set(r.resolveScalarSlot(getOwnedPositionIds(s.t.$.b)![0])!,0);f.commit();s.q.confirm();await flush();expect(s.sent).toEqual([]);}finally{s.dispose();}});
it('private reads do not consume and old prefix acknowledgment cannot clear newer work',()=>{
 const regs=vi.spyOn(life,'registerConnection');const t=signalTree({a:0});const c=link(t.$,{set:()=>{/* This fixture inspects private projection receipts only. */}});const channel=regs.mock.calls.at(-1)![0];
 try{t.$.a(1);const first=read(channel)!;expect(first.payload).toEqual({a:1});expect(first.changed).toBe(true);expect(read(channel)!.changed).toBe(true);t.$.a(2);const second=read(channel)!;expect(second.workEpoch).toBeGreaterThan(first.workEpoch);ack(channel,first);expect(read(channel)!.changed).toBe(true);ack(channel,second);expect(read(channel)!.changed).toBe(false);ack(channel,first);expect(read(channel)!.changed).toBe(false);c.dispose();expect(()=>ack(channel,second)).not.toThrow();}finally{c.dispose();t.destroy();regs.mockRestore();}
});
it('private legacy same-fact adoption consumes work without sticky refresh',async()=>{
 const regs=vi.spyOn(life,'registerConnection');const s=fixture();const channel=regs.mock.calls[0]![0];
 try{s.c.declare({kind:'independent'},()=>s.t.$.a(1));await flush();getPathNotifier().notify('a',2,1,'a',undefined,getOwnedPositionIds(s.t.$.a),undefined,(await import('./internals/position-registry')).getPositionRegistry(s.t.$)!.id);await flush();expect(s.sent.at(-1)).toEqual({a:2,b:0});const receipt=read(channel)!;expect(receipt.changed).toBe(false);expect(read(channel)!.changed).toBe(false);}finally{s.dispose();regs.mockRestore();}
});
it('private unfinished prepared clone retains earlier value work until completion',async()=>{
 const s=fixture();try{s.q.confirm();const r=getTreeScalarSlotRuntime(s.t.$)!;s.c.declare({kind:'independent'},()=>s.t.$.a(1));const f=r.beginFrame();f.set(r.resolveScalarSlot(getOwnedPositionIds(s.t.$.b)![0])!,0);const installed=f.prepareCommit!({publish:false})();await flush();expect(s.sent).toEqual([]);r.publishPrepared(installed);await flush();expect(s.sent).toEqual([{a:1,b:0}]);}finally{s.dispose();}
});
it('private recursive refresh cannot expose partially reduced receipt',async()=>{
 const regs=vi.spyOn(life,'registerConnection');const s=fixture();const channel=regs.mock.calls[0]![0];let entered=false,inside:unknown='not-called';const original=RecipientOccurrences.prototype.replace;
 const spy=vi.spyOn(RecipientOccurrences.prototype,'replace').mockImplementation(function(this:RecipientOccurrences,...args){const result=original.apply(this,args);if(!entered){entered=true;inside=pub.refreshSource(channel);}return result;});
 try{s.c.declare({kind:'independent'},()=>s.t.$.a(1));await flush();expect(entered).toBe(true);expect(inside).toBeUndefined();expect(s.sent).toEqual([{a:1,b:0}]);}finally{spy.mockRestore();s.dispose();regs.mockRestore();}
});
it('endpoint reentry selects latest value under later support-only pending revision',async()=>{
 const t=signalTree({a:0,b:0}),foreign=signalTree({z:0},{enhancers:[transactions()]});const q=foreign.transact(()=>foreign.$.z(7));const sent:unknown[]=[];let entered=false;
 const c=link(t.$,{set:v=>{sent.push(v);if(!entered){entered=true;c.declare({kind:'independent'},()=>t.$.a(2));c.declare({kind:'dependent',owners:[q]},()=>t.$.b(0));}}}) as C;
 try{c.declare({kind:'independent'},()=>t.$.a(1));await flush();expect(sent).toEqual([{a:1,b:0}]);q.confirm();await flush();expect(sent).toEqual([{a:1,b:0},{a:2,b:0}]);await c.settled();}finally{c.dispose();q.confirm();t.destroy();foreign.destroy();}
});
it('held value work is released by disposal without endpoint send',async()=>{const s=fixture();try{s.c.declare({kind:'independent'},()=>s.t.$.a(1));s.c.declare({kind:'dependent',owners:[s.q]},()=>s.t.$.b(0));await flush();expect(s.sent).toEqual([]);let done=false;const wait=s.c.settled().then(()=>{done=true;});s.c.dispose();await flush();expect(done).toBe(true);s.q.confirm();await flush();expect(s.sent).toEqual([]);await wait;}finally{s.dispose();}});
// Private completion-triggered later author; no caller-side permission manipulation.
it('completion reentry newer author preserves latest projection across clones',async()=>{const s=fixture();let entered=false;const off=preparePublicationMutations(s.t.$.a,()=>({record:{writes:[],adds:[]},completion:{}}),()=>{if(entered)return;entered=true;s.c.declare({kind:'independent'},()=>s.t.$.a(2));s.c.declare({kind:'dependent',owners:[s.q]},()=>s.t.$.b(0));})!;
 try{expect(()=>s.c.declare({kind:'independent'},()=>s.t.$.a(1))).toThrow('contradiction');await flush();expect(entered).toBe(true);expect(s.t.$()).toEqual({a:2,b:0});expect(s.sent).toEqual([]);s.q.confirm();await flush();expect(s.sent).toEqual([{a:2,b:0}]);}finally{off();s.dispose();}});
