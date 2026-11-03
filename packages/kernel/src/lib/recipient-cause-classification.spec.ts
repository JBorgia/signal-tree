import {expect,it,vi} from 'vitest';
import {link,signalTree,transactions} from '../index';
import {getPathNotifier} from './path-notifier';
import {withWriteContext} from './write-context';
import * as life from './experimental-publication/lifecycle';
type Receipt={read():Readonly<{state:string;basis?:string;reason?:string}>};
type Declared=ReturnType<typeof link>&{declare(input:{kind:'independent'|'unknown'},work:()=>unknown):Receipt};
const flush=async()=>{getPathNotifier().flushSync();for(let i=0;i<80;i++)await Promise.resolve();};
// Domain-only progress/terminal counterparts live in recipient-progress-positive-counterparts.spec.ts.
for(const cause of ['external-origin','unknown-declaration'] as const)for(const terminal of ['confirm','rollback'] as const)it(`${cause}: distinct fixed-window treatment and useful ${terminal}`,async()=>{
 const owner=signalTree({z:0},{enhancers:[transactions()]});const t=signalTree({x:0,pair:{x:0,y:0}});const sent:unknown[]=[],secondary:unknown[]=[];
 const c=link(t.$.pair,{set:v=>{sent.push(v);}}) as Declared;const other=link(t.$.pair,{set:v=>{secondary.push(v);}});const p=owner.transact(()=>owner.$.z(7));
 const evidence:life.RecipientUncertainty[]=[];const proofs:life.Proof[]=[];const prepare=life.prepareRevision;const project=life.projectRevision;
 const a=vi.spyOn(life,'prepareRevision').mockImplementation((...args)=>{if(args[3])evidence.push(args[3]);return prepare(...args);});
 const b=vi.spyOn(life,'projectRevision').mockImplementation((...args)=>{const result=project(...args);proofs.push(result);return result;});
 let later:ReturnType<typeof owner.transact>|undefined;
 try{const ownership=p.inspect();const write=()=>t.$(input=>({...input,pair:{x:input.x+1,y:input.pair.y}}));
 const receipt=c.declare({kind:cause==='unknown-declaration'?'unknown':'independent'},()=>cause==='external-origin'?withWriteContext({origin:'external'},write):write());
 await flush();expect(t.$.pair()).toEqual({x:1,y:0});expect(p.inspect()).toEqual(ownership);expect(secondary).toEqual([]);
 expect(evidence.some(e=>e.recipientDomain)).toBe(true);expect(evidence.some(e=>e.unobservedOrigin)).toBe(cause==='external-origin');expect(evidence.every(e=>!e.invalidAttribution&&!e.uncapturedUpdaterInput)).toBe(true);
 expect(proofs.some(proof=>proof.unknown)).toBe(true);
 expect(sent).toEqual([]);expect(receipt.read()).toMatchObject({state:'conservative',reason:'unknown'});
 later=owner.transact(()=>owner.$.z(8));later.confirm();later=undefined;
 // A distinct pending owner authored later cannot extend either recipient window.
 const lateOwner=signalTree({z:0},{enhancers:[transactions()]});const late=lateOwner.transact(()=>lateOwner.$.z(9));
 try{p[terminal]();await flush();expect(sent).toEqual([{x:1,y:0}]);expect(secondary).toEqual([{x:1,y:0}]);expect(receipt.read()).toMatchObject({state:'started',basis:'surviving'});await c.settled();await other.settled();expect(lateOwner.$.z()).toBe(9);}finally{late.confirm();lateOwner.destroy();}
 }finally{a.mockRestore();b.mockRestore();c.dispose();other.dispose();later?.confirm();t.destroy();owner.destroy();}
});
