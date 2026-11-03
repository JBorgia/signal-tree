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
function contribution(proof:Proof,unresolved:boolean):Counts {
 const result=empty();result.unresolved=Number(unresolved);
 for(const role of roles)for(const owner of proof[role]??[])count(result[role],owner,1);
 for(const key of ['unknown','invalid','unavailableInput','historicalWindow'] as const)if(proof[key])count(result.flags,key,1);
 for(const bit of [1,2,4,8])if((proof.terminalRejectedRoles??0)&bit)count(result.rejected,bit,1);
 return result;
}
type Entry={requirement:Requirement;proof:Proof;counts:Counts;release?:()=>void;onProof?:(proof:Proof)=>void};
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
 private cancel(entry:Entry):void {if(entry.release){entry.release();entry.release=undefined;this.counters.subscriptions--;}}
 private replaceEntry(group:Group,key:unknown,requirement?:Requirement,onProof?:(proof:Proof)=>void):void {
  const old=group.entries.get(key);if(old){this.cancel(old);this.propagate(group,old.counts,-1);group.entries.delete(key);}
  if(!requirement)return;
  const proof=lifecycle.nativeProof(requirement),unresolved=!lifecycle.nativeRequirementReady(requirement);
  const entry:Entry={requirement,proof,counts:contribution(proof,unresolved),onProof};group.entries.set(key,entry);this.propagate(group,entry.counts,1);onProof?.(proof);
  if(unresolved){
   this.counters.subscriptions++;
   entry.release=lifecycle.onNativeRequirementReady(requirement,()=>{
    if(this.disposed||group.entries.get(key)!==entry)return;
    this.cancel(entry);this.counters.finalized++;
    this.propagate(group,entry.counts,-1);entry.proof=lifecycle.nativeProof(requirement);entry.counts=contribution(entry.proof,false);
    const selected=this.propagate(group,entry.counts,1);entry.onProof?.(entry.proof);if(selected)this.wake();
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
