import { captureNativeOccurrence, isNativeOccurrence, occurrenceIdentity, type NativeOccurrence, type NativeOccurrenceEdge } from '../internals/native-occurrence';
import * as lifecycle from './lifecycle';
type Proof = Readonly<lifecycle.Proof>;
type Requirement = lifecycle.NativeRequirement;
const roles = ['owners','destination','input','validation','possible'] as const;
type Counts = { owners:Map<lifecycle.OwnerCell,number>;destination:Map<lifecycle.OwnerCell,number>;input:Map<lifecycle.OwnerCell,number>;validation:Map<lifecycle.OwnerCell,number>;possible:Map<lifecycle.OwnerCell,number>; flags:Map<string,number>;rejected:Map<number,number>;unresolved:number };
const empty = ():Counts => ({owners:new Map(),destination:new Map(),input:new Map(),validation:new Map(),possible:new Map(),flags:new Map(),rejected:new Map(),unresolved:0});
function count<K>(map:Map<K,number>,key:K,delta:number):void {const next=(map.get(key)??0)+delta;if(next<0)throw Error('Negative occurrence contribution');if(next)map.set(key,next);else map.delete(key);}
function add(target:Counts,source:Counts,direction:number):void {
 for(const role of roles)for(const [key,n]of source[role])count(target[role],key,n*direction);
 for(const [key,n]of source.flags)count(target.flags,key,n*direction);
 for(const [key,n]of source.rejected)count(target.rejected,key,n*direction);
 target.unresolved+=source.unresolved*direction;if(target.unresolved<0)throw Error('Negative occurrence readiness');
}
const flagKeys=['unknown','invalid','unavailableInput','historicalWindow'] as const;
type Contribution=Readonly<Partial<Record<typeof roles[number],readonly lifecycle.OwnerCell[]>>&{flags:number;rejected:number;unresolved:number}>;
const noContribution:Contribution=Object.freeze({flags:0,rejected:0,unresolved:0});
// A fixed 9-bit domain: roleless terminal/window flags need no per-slot object.
const rolelessContributions:(Contribution|undefined)[]=new Array(512);
rolelessContributions[0]=noContribution;
/** Slots need a removable snapshot, not seven independently counted Maps.
 * Only group summaries combine multiplicities. Copy nonempty role arrays so a
 * later requirement transition cannot rewrite the contribution being removed. */
function contribution(proof:Proof,unresolved:boolean):Contribution {
 let flags=0;for(let i=0;i<flagKeys.length;i++)if(proof[flagKeys[i]])flags|=1<<i;
 const rejected=(proof.terminalRejectedRoles??0)&15;
 if(roles.every(role=>!proof[role]?.length)){
  const key=flags|(rejected<<4)|(Number(unresolved)<<8);
  return rolelessContributions[key]??=(Object.freeze({flags,rejected,unresolved:Number(unresolved)}));
 }
 const result:Partial<Record<typeof roles[number],readonly lifecycle.OwnerCell[]>>&{flags:number;rejected:number;unresolved:number}={flags,rejected,unresolved:Number(unresolved)};
 for(const role of roles)if(proof[role]?.length)result[role]=Object.freeze([...proof[role]]);
 return Object.freeze(result);
}
function addContribution(target:Counts,source:Contribution,direction:number):void {
 for(const role of roles)for(const owner of source[role]??[])count(target[role],owner,direction);
 for(let i=0;i<flagKeys.length;i++)if(source.flags&(1<<i))count(target.flags,flagKeys[i],direction);
 for(const bit of [1,2,4,8])if(source.rejected&bit)count(target.rejected,bit,direction);
 target.unresolved+=source.unresolved*direction;if(target.unresolved<0)throw Error('Negative occurrence readiness');
}
type Entry={counts:Contribution;release?:()=>void;onProof?:(proof:Proof)=>void};
// Roleless entries have a fixed flag domain and retain no owner identities.
const rolelessReadyEntries:(Entry|undefined)[]=new Array(256);
// Consecutive bulk facts share one exact ready entry. Weak references keep this
// bounded one-item cache from owning a disposed slot or a mutated old proof.
let lastReadyProof:WeakRef<Proof>|undefined,lastReadyEntry:WeakRef<Entry>|undefined;
function readyEntry(proof:Proof):Entry {
 const prior=lastReadyProof?.deref()===proof?lastReadyEntry?.deref():undefined;
 if(prior){
  let flags=0;for(let i=0;i<flagKeys.length;i++)if(proof[flagKeys[i]])flags|=1<<i;
  const saved=prior.counts;
  // Proof objects may change in place. Identity is only a candidate lookup;
  // every role, duplicate, flag and rejected bit must still match the snapshot.
  if(saved.flags===flags&&saved.rejected===((proof.terminalRejectedRoles??0)&15)&&roles.every(role=>{
   const current=proof[role]??[],before=saved[role]??[];
   return current.length===before.length&&current.every((cell,index)=>cell===before[index]);
  }))return prior;
 }
 const counts=contribution(proof,false);
 if(roles.every(role=>!counts[role]?.length)){
  const key=counts.flags|(counts.rejected<<4);
  return rolelessReadyEntries[key]??=(Object.freeze({counts}));
 }
 const entry=Object.freeze({counts});
 lastReadyProof=new WeakRef(proof);lastReadyEntry=new WeakRef(entry);
 return entry;
}
export interface OccurrenceHandle { readonly identity:object }
type Group=OccurrenceHandle & {parent?:Group;edge?:NativeOccurrenceEdge;guard:object;present:boolean;entries:Map<unknown,Entry>;children:Set<Group>;summary:Counts};

/** One index per recipient. All contributor kinds have the same exact-slot lifecycle. */
export class RecipientOccurrences {
 private readonly groups=new Map<object,Group>();
 private root?:Group;
 private disposed=false;
 private counters={propagated:0,finalized:0,subscriptions:0};
 constructor(private readonly wake:()=>void,private readonly membership:(edge:NativeOccurrenceEdge)=>Requirement,private readonly enrolled?:(edge:NativeOccurrenceEdge,handle:OccurrenceHandle,requirement:Requirement)=>((proof:Proof)=>void)|void){}
 enroll(source:object):OccurrenceHandle {return this.enrollCaptured(captureNativeOccurrence(source));}
 enrollCaptured(occurrence:NativeOccurrence):OccurrenceHandle {
  if(this.disposed||!isNativeOccurrence(occurrence))throw Error('Invalid occurrence enrollment');
  const rootId=occurrenceIdentity(occurrence.root);
  if(this.root&&this.root.identity!==rootId)throw Error('Recipient occurrence belongs to another root');
  if(!this.root){this.root=this.group(rootId);this.groups.set(rootId,this.root);}
  let parent=this.root;
  for(const edge of occurrence.edges){
   const identity=occurrenceIdentity(edge.child);let child=this.groups.get(identity);
   if(child&&child.parent!==parent)throw Error('Native occurrence ancestry mismatch');
   if(!child){
    child=this.group(identity,parent,edge);this.groups.set(identity,child);parent.children.add(child);
    if(!edge.entity){const requirement=this.membership(edge);const update=this.enrolled?.(edge,child,requirement);this.replaceEntry(parent,child.guard,requirement,update??undefined);}
   }
   parent=child;
  }
  return parent;
 }
 private group(identity:object,parent?:Group,edge?:NativeOccurrenceEdge):Group {return {identity,parent,edge,guard:{},present:edge?.present??true,entries:new Map(),children:new Set(),summary:empty()};}
 private get(handle:OccurrenceHandle):Group {const group=this.groups.get(handle.identity);if(this.disposed||group!==handle)throw Error('Stale occurrence handle');return group;}
 private propagate(group:Group,counts:Counts,direction:number):boolean {
  let current:Group|undefined=group;
  while(current){this.counters.propagated++;add(current.summary,counts,direction);if(!current.parent)return true;if(!current.present)return false;current=current.parent;}
  return false;
 }
 private propagateContribution(group:Group,counts:Contribution,direction:number):boolean {
  let current:Group|undefined=group;
  while(current){this.counters.propagated++;addContribution(current.summary,counts,direction);if(!current.parent)return true;if(!current.present)return false;current=current.parent;}
  return false;
 }
 private cancel(entry:Entry):void {if(entry.release){entry.release();entry.release=undefined;this.counters.subscriptions--;}}
 private replaceEntry(group:Group,key:unknown,requirement?:Requirement,onProof?:(proof:Proof)=>void):void {
  const old=group.entries.get(key);if(old){this.cancel(old);this.propagateContribution(group,old.counts,-1);group.entries.delete(key);}
  if(!requirement)return;
  const proof=lifecycle.nativeProof(requirement),unresolved=!lifecycle.nativeRequirementReady(requirement);
  // Pending readiness and callbacks remain owned by their exact address. A
  // ready callback-free entry has no mutable lifecycle and can be shared.
  const entry:Entry=unresolved||onProof?{counts:contribution(proof,unresolved),onProof}:readyEntry(proof);group.entries.set(key,entry);this.propagateContribution(group,entry.counts,1);onProof?.(proof);
  if(unresolved){
   this.counters.subscriptions++;
   entry.release=lifecycle.onNativeRequirementReady(requirement,()=>{
    if(this.disposed||group.entries.get(key)!==entry)return;
    this.cancel(entry);this.counters.finalized++;
    this.propagateContribution(group,entry.counts,-1);const settledProof=lifecycle.nativeProof(requirement);entry.counts=contribution(settledProof,false);
    const selected=this.propagateContribution(group,entry.counts,1);entry.onProof?.(settledProof);if(selected)this.wake();
   });
  }
 }
 replace(handle:OccurrenceHandle,key:unknown,requirement?:Requirement,onProof?:(proof:Proof)=>void):void {this.replaceEntry(this.get(handle),key,requirement,onProof);}
 setPresence(handle:OccurrenceHandle,present:boolean,requirement:Requirement):void {
  const group=this.get(handle);if(!group.parent)throw Error('Root has no membership edge');
  this.replaceEntry(group.parent,group.guard,requirement);
  if(group.present===present)return;
  this.propagate(group.parent,group.summary,present?1:-1);group.present=present;
 }
 exposed(handle:OccurrenceHandle):boolean {let group:Group|undefined=this.get(handle);while(group){if(!group.present)return false;group=group.parent;}return true;}
 unresolved():number {return this.root?.summary.unresolved??0;}
 proof():Proof {
  const summary=this.root?.summary??empty();
  return {owners:[...summary.owners.keys()],destination:[...summary.destination.keys()],input:[...summary.input.keys()],validation:[...summary.validation.keys()],possible:[...summary.possible.keys()],terminalRejectedRoles:[...summary.rejected.keys()].reduce((a,b)=>a|b,0),unknown:summary.flags.has('unknown'),invalid:summary.flags.has('invalid'),unavailableInput:summary.flags.has('unavailableInput'),historicalWindow:summary.flags.has('historicalWindow')};
 }
 inspect(){return {...this.counters,groups:this.groups.size,slots:[...this.groups.values()].reduce((n,g)=>n+g.entries.size,0)};}
 dispose():void {if(this.disposed)return;for(const group of this.groups.values())for(const entry of group.entries.values())this.cancel(entry);this.groups.clear();this.root=undefined;this.disposed=true;}
}
