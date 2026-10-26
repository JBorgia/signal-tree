import type { WriteMetadata } from '../mutation-types';
import * as projection from './projection';
import * as lifecycle from './lifecycle';
export {stampSource,subscribeProjection,deliverEqual} from './projection';
export {enroll,SignalTreePublicationError} from './lifecycle';
type Cell=lifecycle.OwnerCell;
type Fact=Readonly<{revision:number;clean:boolean;blockers:readonly Cell[];unknown:boolean}>;
type Meta=WriteMetadata & { readonly [stamp]?:Fact };
export const stamp=Symbol('research revision');
const facts=new WeakSet<object>();
const grants=new WeakMap<Fact,Set<object>>();
const latest=new Map<object,Fact>();
const callbacks=new Map<object,()=>void>();
let serial=0;let ingress:{owner:number;position:number;consumed:boolean}|undefined;
export const receipts:unknown[]=[];export let enabled=true;
function log(value:unknown){receipts.push(value);if(receipts.length>64)receipts.shift();}
export function mode(value:boolean):void{enabled=value;}
export function register(owner:number,_source:unknown,token:object):void{lifecycle.registerOwnerSource(owner,token);}
export function unregister(owner:number|undefined):void{if(owner!==undefined)lifecycle.unregisterOwnerSource(owner);}
export function transition(owner:number|undefined,event:{kind:string;transactionId:number}):void{if(owner!==undefined){lifecycle.ownerTransition(owner,event);log({event:'lifecycle',owner,...event});}}
export function bindSource(channel:object,owner:number,position:number,identity:Parameters<typeof projection.bindSource>[3],report:(error:unknown)=>void=()=>{}):void{
 projection.bindSource(channel,owner,position,identity);lifecycle.registerConnection(channel,{supported:identity.supported,report,wake:()=>callbacks.get(channel)?.()});
}
export function onEligibility(_owner:number,cb:()=>void,channel:object):()=>void{callbacks.set(channel,cb);return()=>{callbacks.delete(channel);};}
export function acquire(owner:number,position:number,work:()=>void):void{const prev=ingress;ingress={owner,position,consumed:false};try{work();}finally{ingress=prev;}}
export function annotate(meta:Meta|undefined,owner:number|undefined,positions:number[]|undefined,authored:boolean,_payload:unknown):Meta{
 if(meta?.participation==='inspection')return {...meta};
 const clean=!!ingress&&!ingress.consumed&&owner===ingress.owner&&positions?.[0]===ingress.position;if(clean&&ingress)ingress.consumed=true;
 const blockers=lifecycle.pendingOwners();const attributed=meta?.transactionId;
 const known=owner!==undefined&&typeof attributed==='number'?lifecycle.ownerCell(owner,attributed):undefined;
 const valid=attributed===undefined||!!known&&meta?.transactionOwner===lifecycle.ownerToken(owner!);
 const unknown=!clean&&(!authored||meta?.origin!==undefined||owner===undefined||!lifecycle.ownerToken(owner)||!valid);
 const fact:Fact=Object.freeze({revision:++serial,clean,blockers:Object.freeze([...blockers]),unknown});facts.add(fact);
 for(const channel of projection.matchingChannels(owner,positions,meta)){
  const prior=latest.get(channel);
  latest.set(channel,fact);projection.admitted(channel,fact);lifecycle.attachRevision(channel,fact,known?[known]:[],unknown);if(prior)lifecycle.supersede(channel,prior);
 }
 // Diagnostic values are detached primitives; never retain cells, payloads or tokens.
 log({event:'revision',owner,revision:fact.revision,clean,unknown});return {...meta,[stamp]:fact};
}
export function evidence(meta:unknown):Fact|undefined{const value=(meta as Meta|undefined)?.[stamp];return value&&typeof value==='object'&&facts.has(value)?value as Fact:undefined;}
export function complete(meta:unknown):void{projection.completeSource(evidence(meta));}
export function refresh():undefined{return undefined;}
export function pendingDecision(fact:Fact|undefined,channel:object):boolean{return !!fact&&lifecycle.decision(channel,fact).pending;}
export function allowed(fact:Fact|undefined,_owner:number,_position:number,channel:object):boolean{return !enabled||!projection.supported(channel)||!lifecycle.isValidating()&&!!fact&&projection.isLatest(channel,fact)&&(fact.clean||lifecycle.decision(channel,fact).early||grants.get(fact)?.has(channel)===true);}
type Request={claimant:unknown;key:object;run:()=>void};
export function admit(original:(r:Request)=>void,fact:Fact|undefined,_owner:number,_position:number,channel:object,r:Request):boolean{
 if(!enabled||!projection.supported(channel)){original(r);return true;}
 if(lifecycle.isValidating())return false;
 const d=fact&&lifecycle.decision(channel,fact);
 if(fact&&(fact.clean||d?.early)&&projection.isLatest(channel,fact)){r.run();return true;}
 if(d?.pending||fact?.blockers.some(x=>x.outcome==='pending'))return false;
 original({...r,run:()=>{if(fact){let set=grants.get(fact);if(!set)grants.set(fact,set=new Set());set.add(channel);}r.run();}});return true;
}
export function started(fact:Fact|undefined,channel:object):void{if(fact)lifecycle.started(channel,fact,grants.get(fact)?.has(channel)?'surviving':'declared');}
export function dispose(channel:object,_other:object):void{lifecycle.disposeConnection(channel);callbacks.delete(channel);latest.delete(channel);projection.releaseSource(channel);}
export function heldCount():number{return lifecycle.diagnostics().operations;}
export function diagnostics(){return {...lifecycle.diagnostics(),...projection.projectionCounts(),listeners:callbacks.size,latest:latest.size};}
export function declare(channel:object,_owner:number,_position:number,input:unknown,work:()=>unknown,_disposed:()=>boolean){return lifecycle.runDeclaration(channel,input,work);}
function factOf(value:object|undefined):Fact|undefined{return value&&facts.has(value)?value as Fact:undefined;}
export function project(channel:object,meta:unknown,payload:unknown):Fact|undefined{return factOf(projection.project(channel,evidence(meta),payload));}
export function refreshSource(channel:object):Readonly<{fact:Fact;payload:unknown}>|undefined{const value=projection.refreshSource(channel);const fact=factOf(value?.fact);return fact&&value?{fact,payload:value.payload}:undefined;}
