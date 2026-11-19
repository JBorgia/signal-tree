from pathlib import Path
root=Path('/private/tmp/st-projection-certificate-successor')
p=root/'packages/kernel/src/lib/experimental-publication/lifecycle.ts'
s=p.read_text().replace('export type NativeRequirement={proof?:Proof;','export type NativeRequirement={readonly components?:readonly NativeRequirement[];proof?:Proof;')
pos=s.index('/** Capture before user code:')
s=s[:pos]+'''// Readiness is independent of proof presence: composite proofs are live views.
const unfinishedRequirements=new WeakSet<NativeRequirement>();
const requirementListeners=new WeakMap<NativeRequirement,Set<()=>void>>();
export function nativeRequirementReady(requirement:NativeRequirement):boolean {
 return !unfinishedRequirements.has(requirement)&&(requirement.components??[]).every(nativeRequirementReady);
}
export function combineNativeRequirements(components:readonly NativeRequirement[]):NativeRequirement {
 const sources=Object.freeze([...new Set(components)]);
 return {components:sources,get proof(){return combineProofs(sources.map(nativeProof));},inputs:[],frames:[],known:[],unknown:false,possible:[],captureWindow:false};
}
export function onNativeRequirementReady(requirement:NativeRequirement,callback:()=>void):()=>void {
 if(nativeRequirementReady(requirement)){callback();return ()=>{};}
 let active=true;
 const releases:(()=>void)[]=[];
 const release=()=>{active=false;for(const off of releases)off();releases.length=0;};
 const check=()=>{if(active&&nativeRequirementReady(requirement)){release();callback();}};
 const visit=(part:NativeRequirement)=>{
  if(unfinishedRequirements.has(part)){
   let listeners=requirementListeners.get(part);if(!listeners)requirementListeners.set(part,listeners=new Set());
   listeners.add(check);releases.push(()=>{listeners!.delete(check);if(!listeners!.size)requirementListeners.delete(part);});
  }
  for(const child of part.components??[])visit(child);
 };
 visit(requirement);return release;
}
function notifyRequirement(requirement:NativeRequirement):void {
 const callbacks=requirementListeners.get(requirement);requirementListeners.delete(requirement);
 for(const callback of [...callbacks??[]])callback();
}
''' +s[pos:]
s=s.replace('const evidence=nativeProof(requirement);','unfinishedRequirements.add(requirement);\n const evidence=nativeProof(requirement);',1)
s=s.replace('requirement.inputs=[];requirement.known=[];}','requirement.inputs=[];requirement.known=[];unfinishedRequirements.delete(requirement);notifyRequirement(requirement);}',1)
s=s.replace('h.requirements.clear();\n const operations', '''// All sources close before any recipient recomposes its selected support.
 for(const requirement of h.requirements)unfinishedRequirements.delete(requirement);
 for(const requirement of h.requirements)notifyRequirement(requirement);
 h.requirements.clear();
 const operations''')
p.write_text(s)
p=root/'packages/kernel/src/lib/experimental-publication/entity.ts';s=p.read_text();s=s.replace('return {get proof(){return lifecycle.combineProofs(sources.map(lifecycle.nativeProof));},known:[],unknown:false,possible:[],captureWindow:false,frames:[],inputs:[]};','return lifecycle.combineNativeRequirements(sources);');p.write_text(s)
p=root/'packages/kernel/src/lib/experimental-publication/private.ts';s=p.read_text()
s=s.replace('type CollectionSupport={relative:', 'type CollectionSupport={payload:unknown;relative:')
s=s.replace('type Binding={collections:', 'type Binding={watches:Map<object,()=>void>;collections:')
s=s.replace('let ingress:{owner:number;position:number;consumed:boolean;collections:Set<object>}','let ingress:{channel:object;consumed:boolean;collections:Set<object>}')
s=s.replace('ingress.owner===b.owner&&ingress.position===b.position','ingress.channel===channel')
s=s.replace('binding.owner===ingress.owner&&binding.position===ingress.position','ingress.channel===channel')
s=s.replace('export function acquire(owner:number,position:number,work:()=>void):void{const prev=ingress;ingress={owner,position,consumed:false,collections:new Set()};','export function acquire(channel:object,work:()=>void):void{const prev=ingress;ingress={channel,consumed:false,collections:new Set()};')
s=s.replace('const safe=!proof.invalid', 'const safe=lifecycle.nativeRequirementReady(requirement)&&!proof.invalid')
s=s.replace('const binding:Binding={collections:', 'const binding:Binding={watches:new Map(),collections:')
s=s.replace('for(const release of b?.releases??[])release();','for(const release of b?.releases??[])release();for(const release of b?.watches.values()??[])release();')
# Every stored enrollment fact keeps source identity until finalization.
s=s.replace('const ownProofs=new WeakMap<Fact,Proof>();','const ownProofs=new WeakMap<Fact,Proof>();\nconst factRequirements=new WeakMap<Fact,lifecycle.NativeRequirement>();')
pos=s.index('function projectionSupport(')
s=s[:pos]+'''function rebuildEnrollmentSummary(channel:object,b:Binding):void {
 b.summary=emptySummary();
 for(const [field,fact]of b.completedFields)if(exposed(b,b.fields.get(field)!.address))adjust(b.summary,own(fact,channel),1);
 for(const [slot,state]of b.completedPresence)if(internalSlot(b,slot)&&exposed(b,slot.address!,slot))adjust(b.summary,own(state.fact,channel),1);
}
function watchFact(channel:object,b:Binding,fact:Fact):void {
 const requirement=factRequirements.get(fact);if(!requirement||lifecycle.nativeRequirementReady(requirement)||b.watches.has(fact))return;
 const off=lifecycle.onNativeRequirementReady(requirement,()=>{
  b.watches.delete(fact);if(bindings.get(channel)!==b)return;
  const proof=lifecycle.nativeProof(requirement);ownProofs.set(fact,proof);proofs.set(fact,proof);
  rebuildEnrollmentSummary(channel,b);wakeChannel(channel);
 });b.watches.set(fact,off);
}
function collectionSelected(b:Binding,collection:CollectionSupport):boolean {
 const relative=collection.relative??[];
 return exposed(b,[...(b.address??[]),...relative])&&(!relative.length||pathValue(b.valuePayload,relative).present);
}
function setCollectionEntry(channel:object,b:Binding,collection:CollectionSupport,key:string,requirement?:lifecycle.NativeRequirement):void {
 const old=collection.entries.get(key);if(old){b.watches.get(old)?.();b.watches.delete(old);adjust(collection.summary,old.proof,-1);}
 if(!requirement){collection.entries.delete(key);return;}
 const entry={requirement,proof:lifecycle.nativeProof(requirement)};collection.entries.set(key,entry);adjust(collection.summary,entry.proof,1);
 if(!lifecycle.nativeRequirementReady(requirement)){
  const off=lifecycle.onNativeRequirementReady(requirement,()=>{
   b.watches.delete(entry);if(bindings.get(channel)!==b||collection.entries.get(key)!==entry)return;
   adjust(collection.summary,entry.proof,-1);entry.proof=lifecycle.nativeProof(requirement);adjust(collection.summary,entry.proof,1);wakeChannel(channel);
  });b.watches.set(entry,off);
 }
}
function selectedReady(b:Binding):boolean {
 const ready=(fact:Fact)=>{const requirement=factRequirements.get(fact);return !requirement||lifecycle.nativeRequirementReady(requirement);};
 for(const [slot,state]of b.completedPresence)if(exposed(b,slot.address??[],slot)&&!ready(state.fact))return false;
 for(const [field,fact]of b.completedFields)if(exposed(b,b.fields.get(field)!.address)&&!ready(fact))return false;
 if(!b.aggregate&&!ready(b.completedValueFact))return false;
 for(const collection of b.collections.values())if(collectionSelected(b,collection))for(const entry of collection.entries.values())if(!lifecycle.nativeRequirementReady(entry.requirement))return false;
 return true;
}
''' +s[pos:]
s=s.replace('[...b.collections.values()].map(value=>summaryProof(value.summary))','[...b.collections.values()].filter(value=>collectionSelected(b,value)).map(value=>summaryProof(value.summary))')
s=s.replace('if(!unit.complete)break;','if(!unit.complete||!selectedReady(b)||unit.selected&&!lifecycle.nativeRequirementReady(unit.selected))break;')
s=s.replace('const old=collection.entries.get(edit.key);if(old)adjust(collection.summary,old.proof,-1);\n     if(edit.after){const requirement=edit.after as lifecycle.NativeRequirement;const proof=lifecycle.nativeProof(requirement);collection.entries.set(edit.key,{requirement,proof});adjust(collection.summary,proof,1);}else collection.entries.delete(edit.key);','setCollectionEntry(channel,b,collection,edit.key,edit.after as lifecycle.NativeRequirement|undefined);')
s=s.replace('b.valuePayload=collection.relative?applyAtRelativePath(b.valuePayload,collection.relative,{all:unit.payload}):unit.payload;', 'collection.payload=unit.payload;\n   if(collectionSelected(b,collection))b.valuePayload=collection.relative?applyAtRelativePath(b.valuePayload,collection.relative,{all:unit.payload}):unit.payload;')
# Membership selects retained native occurrence payload; no physical post-notification reseed.
s=s.replace('const after=unit.presence.ordinary?.after;','''const after=unit.presence.ordinary?.after;
   if(after?.present&&relative!==undefined){
    for(const collection of b.collections.values()){
     if(collection.relative&&relativeSourceAddress(relative,collection.relative)!==undefined&&exposed(b,[...(b.address??[]),...collection.relative])){
      const below=relativeSourceAddress(relative,collection.relative)!;
      if(pathValue(after.value,below).present)b.valuePayload=applyAtRelativePath(b.valuePayload,collection.relative,{all:collection.payload});
     }
    }
   }''')
s=s.replace('initial:ReadonlyMap<string,object>):void', 'initial:ReadonlyMap<string,object>,payload:unknown):void')
s=s.replace('const support:CollectionSupport={relative,entries:new Map(),summary:emptySummary()};\n for(const [slot,reference]of initial){const requirement=reference as lifecycle.NativeRequirement;const proof=lifecycle.nativeProof(requirement);support.entries.set(slot,{requirement,proof});adjust(support.summary,proof,1);}', 'const support:CollectionSupport={payload,relative,entries:new Map(),summary:emptySummary()};\n for(const [slot,reference]of initial)setCollectionEntry(channel,b,support,slot,reference as lifecycle.NativeRequirement);')
s=s.replace('proofs.set(fact,proof);ownProofs.set(fact,proof);return fact;', 'proofs.set(fact,proof);ownProofs.set(fact,proof);factRequirements.set(fact,requirement);return fact;')
s=s.replace('if(nativeProof){proofs.set(fieldFact,nativeProof);ownProofs.set(fieldFact,nativeProof);}', 'if(nativeProof){proofs.set(fieldFact,nativeProof);ownProofs.set(fieldFact,nativeProof);factRequirements.set(fieldFact,requirement!);}')
s=s.replace('binding.valueFact=fieldFact;binding.completedValueFact=fieldFact;', 'factRequirements.set(fieldFact,requirement);binding.valueFact=fieldFact;binding.completedValueFact=fieldFact;')
s=s.replace('if(identity.supported&&context&&source){trieFor', 'for(const fact of new Set([binding.completedValueFact,...binding.completedFields.values(),...[...binding.completedPresence.values()].map(state=>state.fact)]))watchFact(channel,binding,fact);\n if(identity.supported&&context&&source){trieFor')
# Binding object identity is replaced in terminal records; maps retain exact binding lifetime.
s=s.replace('bindings.get(channel)!==b', 'bindings.get(channel)?.watches!==b.watches')
# summary is replaced by rebuild: ensure update on current binding, not stale shallow copy.
s=s.replace('rebuildEnrollmentSummary(channel,b);wakeChannel(channel);', 'rebuildEnrollmentSummary(channel,bindings.get(channel)!);wakeChannel(channel);')
p.write_text(s)
p=root/'packages/kernel/src/lib/link.ts';s=p.read_text().replace('research.acquire(registry.id, publicationPosition, () =>','research.acquire(consequenceKey, () =>').replace('nested?.relativeAddress,projection.support());','nested?.relativeAddress,projection.support(),projection.value());')
s=s.replace('if (entityLocation || isInspectionWrite(meta)) return;','if (entityLocation || isInspectionWrite(meta)) return;\n        if(research.enabled){dirty=true;observeLink();return;}')
p.write_text(s)
