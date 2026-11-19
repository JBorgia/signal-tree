import {expect,it,vi} from 'vitest';
import {appendFileSync} from 'node:fs';
import {signalTree,link,transactions} from '../index';
import {getTreeScalarSlotRuntime} from './internals/tree-scalar-slot-port';
import {getOwnedPositionIds} from './internals/owned-mutation';
import {getPathNotifier} from './path-notifier';
import * as research from './experimental-publication/private';
import * as life from './experimental-publication/lifecycle';
it('trace unchanged equal-sibling prepared frame',async()=>{
 const events:unknown[]=[];const ids=new Map<object,number>();const id=(x:object|undefined)=>{if(!x)return undefined;if(!ids.has(x))ids.set(x,ids.size+1);return ids.get(x);};
 const a=research.admit,l=research.allowed,r=research.refreshSource,n=life.noWrite,s=life.supersede,prepare=life.prepareRevision,project=life.projectRevision;
 const spies=[vi.spyOn(life,'prepareRevision').mockImplementation((...args)=>{events.push({event:'prepare',fact:id(args[1]),native:!!args[5],nativeProof:args[5]&&life.nativeProof(args[5]),uncertainty:args[3]});return prepare(...args);}),vi.spyOn(life,'projectRevision').mockImplementation((...args)=>{const result=project(...args);events.push({event:'project',fact:id(args[1]),input:args[2],output:result});return result;}),vi.spyOn(research,'admit').mockImplementation((...args)=>{events.push({event:'admit-before',fact:id(args[1]),proof:args[1]&&life.proof(args[4],args[1]),pending:research.pendingDecision(args[1],args[4])});const result=a(...args);events.push({event:'admit-after',fact:id(args[1]),result});return result;}),vi.spyOn(research,'allowed').mockImplementation((...args)=>{const result=l(...args);events.push({event:'allowed',fact:id(args[0]),result});return result;}),vi.spyOn(research,'refreshSource').mockImplementation((...args)=>{const result=r(...args);events.push({event:'refresh',fact:id(result?.fact),payload:result?.payload,changed:result?.changed});return result;}),vi.spyOn(life,'noWrite').mockImplementation((...args)=>{events.push({event:'noWrite',fact:id(args[1])});return n(...args);}),vi.spyOn(life,'supersede').mockImplementation((...args)=>{events.push({event:'supersede',fact:id(args[1])});return s(...args);})];
 const tree=signalTree({a:0,b:0},{enhancers:[transactions()]}),sent:unknown[]=[];const c=link(tree.$,{set:v=>{sent.push(v);events.push({event:'SEND',value:v});}});
 try{const runtime=getTreeScalarSlotRuntime(tree.$)!,f=runtime.beginFrame();f.set(runtime.resolveScalarSlot(getOwnedPositionIds(tree.$.a)![0])!,1);f.set(runtime.resolveScalarSlot(getOwnedPositionIds(tree.$.b)![0])!,0);f.commit();getPathNotifier().flushSync();for(let i=0;i<100;i++)await Promise.resolve();expect(tree.$()).toEqual({a:1,b:0});events.push({event:'final',sent});}
 finally{appendFileSync(process.env['ST_PACKET_PAIR_OUTPUT']!,JSON.stringify(events)+'\n');c.dispose();tree.destroy();for(const spy of spies)spy.mockRestore();}
});
