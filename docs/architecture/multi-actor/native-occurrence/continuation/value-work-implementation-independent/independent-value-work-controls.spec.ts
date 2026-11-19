import {expect,it,vi} from 'vitest';
import {signalTree,link,transactions} from '../index';
import {getPathNotifier} from './path-notifier';
import {linkStateReader} from './internals/link-state-view';
import * as pub from './experimental-publication/private';
import * as life from './experimental-publication/lifecycle';
type C=ReturnType<typeof link>&{declare(d:{kind:'independent'}|{kind:'dependent';owners:readonly object[]},work:()=>unknown):unknown};
const flush=async()=>{getPathNotifier().flushSync();for(let i=0;i<120;i++)await Promise.resolve();};
it('real Link sending observer reentry blocks old ticket and sends latest payload after current support settles',async()=>{
 const t=signalTree({a:0,b:0}),f=signalTree({z:0},{enhancers:[transactions()]});const q=f.transact(()=>f.$.z(7));
 const sent:unknown[]=[];const c=link(t.$,{set(v){sent.push(v);}}) as C;let entered=false;
 const off=linkStateReader(t).subscribe(e=>{if(e.link.sending&&!entered){entered=true;c.declare({kind:'independent'},()=>t.$.a(2));c.declare({kind:'dependent',owners:[q]},()=>t.$.b(0));}});
 try{c.declare({kind:'independent'},()=>t.$.a(1));await flush();expect(entered).toBe(true);expect(sent).toEqual([]);expect(t.$()).toEqual({a:2,b:0});q.confirm();await flush();expect(sent).toEqual([{a:2,b:0}]);await c.settled();}
 finally{off();c.dispose();q.confirm();t.destroy();f.destroy();}
});
it('captured prefix is recipient scoped and disposed acknowledgment cannot affect a live peer',()=>{
 const regs=vi.spyOn(life,'registerConnection');const t=signalTree({a:0});const a=link(t.$,{set(){}}),b=link(t.$,{set(){}});const ca=regs.mock.calls[0]![0],cb=regs.mock.calls[1]![0];
 try{t.$.a(1);const ra=pub.refreshSource(ca)!,rb=pub.refreshSource(cb)!;expect(ra.changed).toBe(true);expect(rb.changed).toBe(true);pub.acknowledgeProjection(cb,ra);expect(pub.refreshSource(cb)!.changed).toBe(true);a.dispose();pub.acknowledgeProjection(ca,ra);pub.acknowledgeProjection(cb,ra);expect(pub.refreshSource(cb)!.changed).toBe(true);pub.acknowledgeProjection(cb,rb);expect(pub.refreshSource(cb)!.changed).toBe(false);}
 finally{a.dispose();b.dispose();t.destroy();regs.mockRestore();}
});
it('held disposal restores publication registries and resolves settled without later delivery',async()=>{
 await flush();const before=pub.diagnostics();const t=signalTree({a:0,b:0}),f=signalTree({z:0},{enhancers:[transactions()]});const q=f.transact(()=>f.$.z(7));const sent:unknown[]=[];const c=link(t.$,{set(v){sent.push(v);}}) as C;
 try{c.declare({kind:'independent'},()=>t.$.a(1));c.declare({kind:'dependent',owners:[q]},()=>t.$.b(0));await flush();expect(sent).toEqual([]);expect(pub.diagnostics().connections).toBeGreaterThan(before.connections);let done=false;const wait=c.settled().then(()=>{done=true;});await Promise.resolve();expect(done).toBe(false);c.dispose();await flush();expect(done).toBe(true);q.confirm();await flush();expect(sent).toEqual([]);await wait;}
 finally{c.dispose();q.confirm();t.destroy();f.destroy();}
 await flush();expect(pub.diagnostics()).toEqual(before);
});
