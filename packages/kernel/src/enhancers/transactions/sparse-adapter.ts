import {getMutationCaptureRuntime} from '../../lib/internals/mutation-capture-runtime';
import {setEntityRetirementObserver} from '../../lib/internals/entity-retirement';
import {getSubjectRestorationClaims} from '../../lib/internals/subject-restoration-claims';
import type {TerminalRecordPlan} from '../../lib/internals/intrinsic-mutation';
import type {CommittedEntityCapture} from '../../lib/internals/mutation-capture-runtime';
import {collectionBindingAt} from '../../lib/internals/plain-branch-membership';
import {getTreeScalarSlotRuntime} from '../../lib/internals/tree-scalar-slot-port';
import {holdEntityMembershipDelivery} from '../../lib/internals/entity-membership-source';
import {visitTree} from '../../lib/internals/visit-tree';
import type {CollectionTransitionTargetBinding} from '../../lib/internals/causal-runtime/target-transition';
import {createEntityDeltaPreparer, type EntityBridgeDelta} from '../../lib/physical/prepare-entity-delta';
import {createSparseOwnership, type SparseOwner, type SparseRef, type SparseOperation} from '../../lib/internals/sparse-ownership/core';

/** One disposition authority. Public lifecycle/history stay in transactions.ts. */
interface NativeRetirementOwner {
 __inspectSubjectResources(id:number):{state:string}|undefined;
 __prepareSubjectReclamation(id:number,options:{causallyEligible:boolean;reclaimLifetimeRecord:boolean}):unknown;
 __applyPreparedSubjectReclamation(plan:unknown):void;
}
export function createTransactionSparseAdapter(root: object, tree:object) {
 const model=createSparseOwnership();
 const bootstrap=(ops:readonly SparseOperation[])=>model.installPrepared(model.prepareScalarWrite(null,ops));
 const owners=new Map<number,SparseOwner>();
 const scalarSeeds=new Set<number>();
 const physicalOwners=new Map<number,NativeRetirementOwner>();
 const collections=new Map<number,{binding:CollectionTransitionTargetBinding;refs:Map<number,SparseRef>;high:number;low:number}>();
 const subjects=new Map<SparseRef,{owner:number;subject:number}>();
 const scalarRuntime=getTreeScalarSlotRuntime(root);
 if(!scalarRuntime)throw new Error('Sparse transactions require scalar realization');
 const slots=scalarRuntime;
 function collection(owner:number){
  const existing=collections.get(owner);if(existing)return existing;
  const binding=collectionBindingAt(root,owner);if(!binding)throw new Error('Sparse collection binding unavailable');
  const source=binding.readSource(),entry={binding,refs:new Map<number,SparseRef>(),high:source.order.length,low:0};
  const initialRanks=new Map(source.order.map((subject,index)=>[subject,index+1]));
  for(const row of source.subjects){const ref=model.makeRef();bootstrap([{kind:'add',ref,collection:owner,key:row.key,fields:record(row.value),rank:initialRanks.get(row.subject)??0}]);entry.refs.set(row.subject,ref);subjects.set(ref,{owner,subject:row.subject});}
  collections.set(owner,entry);return entry;
 }
 // Initial topology is seeded at enhancer construction, never on a point write.
 visitTree(root,node=>{const descriptor=Object.getOwnPropertyDescriptor(node as object,'__prepareTransitionTarget');const binding=descriptor?.value as CollectionTransitionTargetBinding|undefined;if(binding){physicalOwners.set(binding.owner,node as NativeRetirementOwner);collection(binding.owner);return false;}return undefined;});
 function record(value:unknown):Record<string,unknown>{if(value===null||typeof value!=='object'||Array.isArray(value))throw new Error('Sparse entity payload is not a record');return value as Record<string,unknown>;}
 function reclaim(owner:number,subject:number){
  const entry=collections.get(owner),ref=entry?.refs.get(subject),native=physicalOwners.get(owner);
  if(!entry||!ref||!native||model.obligation(ref).retained)return;
  // Restoration can claim after notifier delivery; its existing eviction/sink
  // owns that handoff. Transactions alone may reclaim an unclaimed lifetime.
  if(Reflect.get(tree,'__restoration')!==undefined)return;
  if(getSubjectRestorationClaims(root)?.isClaimed(subject))return;
  if(native.__inspectSubjectResources(subject)?.state==='active')return;
  const prepared=native.__prepareSubjectReclamation(subject,{causallyEligible:true,reclaimLifetimeRecord:true});
  if(prepared!==undefined)native.__applyPreparedSubjectReclamation(prepared);
  if(native.__inspectSubjectResources(subject)===undefined){entry.refs.delete(subject);subjects.delete(ref);}
 }
 const captureRuntime=getMutationCaptureRuntime(tree);
 const releaseRetirement=captureRuntime?setEntityRetirementObserver(captureRuntime,events=>{for(const event of events)for(const subject of event.subjects)reclaim(event.owner,subject);}):undefined;
 function owner(id:number|undefined){return id===undefined?null:owners.get(id)??null;}
 function open(id:number){owners.set(id,model.openOwner());}
 function scalar(id:number|undefined,position:number,before:unknown,after:unknown):TerminalRecordPlan{
  if(!scalarSeeds.has(position)){bootstrap([{kind:'set',path:[position],value:before}]);scalarSeeds.add(position);}
  return model.prepareScalarWrite(owner(id),[{kind:'set',path:[position],value:after}]);
 }
 function entity(id:number|undefined,capture:CommittedEntityCapture):TerminalRecordPlan|undefined{
  const entry=collection(capture.owner),added=new Map<number,SparseRef>(),ops:SparseOperation[]=[];
  const refFor=(subject:number)=>{const ref=added.get(subject)??entry.refs.get(subject);if(!ref)throw new Error('Sparse lifetime not admitted');return ref;};
  for(const change of capture.changes){const structural=change.structuralRecord;
   if(structural?.kind==='add'){const ref=model.makeRef();added.set(change.subject,ref);ops.push({kind:'add',ref,collection:capture.owner,key:structural.key,fields:record(change.after),rank:++entry.high});}
   else if(structural?.kind==='remove')ops.push({kind:'remove',ref:refFor(change.subject)});
   else if(structural?.kind==='rekey')ops.push({kind:'rekey',ref:refFor(change.subject),key:structural.afterKey});
   else{const before=record(change.before),after=record(change.after),ref=refFor(change.subject);for(const key of Object.keys(before))if(!Object.prototype.hasOwnProperty.call(after,key))ops.push({kind:'delete-field',ref,field:key});for(const [field,value] of Object.entries(after))if(!Object.is(value,before[field])||!Object.prototype.hasOwnProperty.call(before,field))ops.push({kind:'field',ref,field,value});}
  }
  if(capture.ordering){const order=capture.ordering,n=order.subjects.length,start=order.kind==='front'?(entry.low-=n):entry.high+1;if(order.kind!=='front')entry.high+=n;order.subjects.forEach((subject,i)=>ops.push({kind:'rank',ref:refFor(subject),rank:start+i}));}
  if(!ops.length)return;
  const prepared=model.prepareScalarWrite(owner(id),ops);
  return {writes:[...prepared.writes,...[...added].flatMap(([subject,ref])=>[{map:entry.refs,key:subject,value:ref},{map:subjects,key:ref,value:{owner:capture.owner,subject}}])],adds:prepared.adds};
 }
 function settle(id:number,decision:'accept'|'reject',committed:()=>void){
  const token=owners.get(id);if(!token){committed();return;}
  const prepared=model.prepareSettlement(token,decision);
  if('status' in prepared){if(prepared.status==='refused')throw new Error(prepared.reason);committed();return;}
  const frame=slots.beginFrame();for(const target of prepared.targets){const position=target.path[0];if(typeof position!=='number')throw new Error('Sparse scalar address invalid');const slot=slots.resolveScalarSlot(position);if(slot===undefined)throw new Error('Sparse scalar slot unavailable');frame.set(slot,target.value);}
  if(!frame.prepareCommit)throw new Error('Sparse scalar preparation unavailable');const scalarInstall=frame.prepareCommit({publish:false});
  const byCollection=new Map<number,EntityBridgeDelta[]>();
  for(const c of prepared.entityChanges){const identity=subjects.get(c.ref);if(!identity)throw new Error('Sparse native lifetime unavailable');const group=byCollection.get(identity.owner)??[];group.push({subject:identity.subject,before:c.before?{key:c.before.key,value:c.before.fields}:null,after:c.after?{key:c.after.key,value:c.after.fields}:null,beforeSubject:c.beforeRef?subjects.get(c.beforeRef)?.subject:undefined,afterSubject:c.afterRef?subjects.get(c.afterRef)?.subject:undefined,rank:c.after?.rank??c.before?.rank??0,topology:c.topology,orderChanged:!!c.before&&!!c.after&&c.before.rank!==c.after.rank});byCollection.set(identity.owner,group);}
  const entityPlans=[...byCollection].map(([owner,changes])=>collection(owner).binding.prepareTarget({owner,subjects:[],order:[],orderFrontier:{}},createEntityDeltaPreparer(changes)));
  model.assertPrepared(prepared);const release=holdEntityMembershipDelivery(root);let failed=false,first:unknown;
  try{slots.runInvalidationGroup(()=>{const scalarCommit=scalarInstall();for(const plan of entityPlans)plan.install();model.installPrepared(prepared);owners.delete(id);let deliveryFailed=false,deliveryError:unknown;try{committed();}catch(error){deliveryFailed=true;deliveryError=error;}for(const publish of [...entityPlans.map(p=>()=>p.publish()),()=>slots.publishPrepared(scalarCommit)])try{publish();}catch(error){if(!deliveryFailed){deliveryFailed=true;deliveryError=error;}}if(deliveryFailed)throw deliveryError;});}catch(error){failed=true;first=error;}
  try{release();}catch(error){if(!failed){failed=true;first=error;}}for(const ref of prepared.affectedRefs){const identity=subjects.get(ref);if(identity)try{reclaim(identity.owner,identity.subject);}catch(error){if(!failed){failed=true;first=error;}}}if(failed)throw first;
 }
 return {open,scalar,entity,settle,destroy(){releaseRetirement?.();owners.clear();collections.clear();subjects.clear();physicalOwners.clear();model.destroy();}};
}
