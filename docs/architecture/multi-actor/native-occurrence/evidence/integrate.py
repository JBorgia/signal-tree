from pathlib import Path
root=Path('/private/tmp/st-occurrence-successor')
p=root/'packages/kernel/src/lib/experimental-publication/recipient-occurrence.ts';s=p.read_text().replace('=>void){}','=>((proof:Proof)=>void)|void){}',1)
s=s.replace('this.replaceEntry(parent,child.guard,requirement);this.enrolled?.(edge,child,requirement);','const update=this.enrolled?.(edge,child,requirement);this.replaceEntry(parent,child.guard,requirement,update??undefined);')
p.write_text(s)
p=root/'packages/kernel/src/lib/experimental-publication/private.ts';s=p.read_text()
s="import { RecipientOccurrences, type OccurrenceHandle } from './recipient-occurrence';\n"+s
s=s.replace('type CollectionSupport={payload:', 'type CollectionSupport={occurrence:OccurrenceHandle;payload:')
s=s.replace('type Binding={watches:Map<object,()=>void>;', 'type Binding={index:RecipientOccurrences;occurrences:Map<object,OccurrenceHandle>;')
# Replace asymmetric listeners/full readiness scans by mandatory generic index.
a=s.index('function rebuildEnrollmentSummary(');z=s.index('function prepareMembership(',a)
s=s[:a]+'''function requirementOf(proof:Proof):lifecycle.NativeRequirement {
 return {proof,inputs:[],frames:[],known:[],unknown:false,possible:[],captureWindow:false};
}
function installFact(b:Binding,node:object,key:unknown,fact:Fact,requirement:lifecycle.NativeRequirement):void {
 const occurrence=b.occurrences.get(node);if(!occurrence)throw Error('Support has no enrolled occurrence');
 factRequirements.set(fact,requirement);
 b.index.replace(occurrence,key,requirement,proof=>{ownProofs.set(fact,proof);proofs.set(fact,proof);});
}
function collectionSelected(b:Binding,collection:CollectionSupport):boolean {
 return b.index.exposed(collection.occurrence);
}
function setCollectionEntry(_channel:object,b:Binding,collection:CollectionSupport,key:string,requirement?:lifecycle.NativeRequirement):void {
 b.index.replace(collection.occurrence,key,requirement);
 if(requirement)collection.entries.set(key,{requirement,proof:lifecycle.nativeProof(requirement)});else collection.entries.delete(key);
}
function projectionSupport(b:Binding):{proof:Proof;present:boolean}{
 const source=b.source&&b.occurrences.get(b.source);
 return {proof:b.index.proof(),present:!source||b.index.exposed(source)};
}
''' + s[z:]
s=s.replace('if(!unit.complete||!selectedReady(b)||unit.selected&&!lifecycle.nativeRequirementReady(unit.selected))break;', 'if(!unit.complete)break;')
# Install authored evidence dynamically if native finalization is still outstanding.
s=s.replace('const authoredProof=combineProofs([proof,...(unit.native?[lifecycle.nativeProof(unit.native)]:[])]);ownProofs.set(unit.fact,authoredProof);', '''const authoredRequirement=lifecycle.combineNativeRequirements([requirementOf(proof),...(unit.native?[unit.native]:[])]);
  const authoredProof=lifecycle.nativeProof(authoredRequirement);ownProofs.set(unit.fact,authoredProof);''')
# Replace membership body removes scalar loops/summary updates; all selection unified.
a=s.index('  }else if(unit.presence){',s.index('function ready('));z=s.index('  const support=projectionSupport(b);',a)
s=s[:a]+'''  }else if(unit.presence){
   const slot=unit.presence.slot;const occurrence=b.occurrences.get(slot.child);
   if(!occurrence)throw Error('Membership support has no enrolled occurrence');
   b.completedPresence.set(slot,unit.presence.state);
   b.index.setPresence(occurrence,unit.presence.state.present,authoredRequirement);
   const relative=slot.address&&relativeSourceAddress(b.address??[],slot.address),after=unit.presence.ordinary?.after;
   if(after?.present&&relative!==undefined){
    // The source supplied this ordinary selection before completion. Its value
    // does not come from a later physical read or notification reseed.
    b.valuePayload=applyAtRelativePath(b.valuePayload,relative,after.value);
    for(const collection of b.collections.values())if(collection.relative&&relativeSourceAddress(relative,collection.relative)!==undefined&&collectionSelected(b,collection)){
     b.valuePayload=applyAtRelativePath(b.valuePayload,collection.relative,{all:collection.payload});
    }
   }else if(after?.present&&!b.aggregate&&!b.valueInitialized&&slot.address&&b.address){
    const below=relativeSourceAddress(slot.address,b.address),supplied=below&&pathValue(after.value,below);
    if(supplied?.present){b.valuePayload=supplied.value;b.valueInitialized=true;}
   }
  }else if(unit.field){
   installFact(b,unit.field,'value',unit.fact,authoredRequirement);
   b.completedFields.set(unit.field,unit.fact);b.initialized.add(unit.field);b.valuePayload=applyAtRelativePath(b.valuePayload,unit.relative??[],unit.payload);
  }else{
   if(b.source)installFact(b,b.source,'value',unit.fact,unit.selected?lifecycle.combineNativeRequirements([authoredRequirement,unit.selected]):authoredRequirement);
   b.completedValueFact=unit.fact;b.valuePayload=unit.payload;
  }
''' +s[z:]
# Queue reduction is never held by old selected evidence; resulting readiness gates delivery.
s=s.replace('proofs.set(unit.fact,effective);lifecycle.projectRevision(channel,unit.fact,effective);', 'proofs.set(unit.fact,effective);lifecycle.projectRevision(channel,unit.fact,effective,b.index.unresolved()!==0);')
# Collection registration requires real source; payload kept optional for old private API arity.
s=s.replace('initial:ReadonlyMap<string,object>,payload:unknown):void','initial:ReadonlyMap<string,object>,payload?:unknown):void')
s=s.replace('const support:CollectionSupport={payload,relative,entries:new Map(),summary:emptySummary()};', '''const occurrence=b.index.enroll(key);b.occurrences.set(key,occurrence);
 const support:CollectionSupport={occurrence,payload:payload??pathValue(b.valuePayload,relative??[]).value,relative,entries:new Map(),summary:emptySummary()};''')
# Generic enrollment before kind discrimination, with initial clean ancestry included.
a=s.index(' const presence=new Map<Slot,Presence>();',s.index('export function bindSource('));z=s.index(' if(identity.supported&&context&&source){trieFor',a)
s=s[:a]+''' let binding!:Binding;
 const index=new RecipientOccurrences(()=>{
  if(bindings.get(channel)?.index!==index)return;
  const current=bindings.get(channel)!;
  if(current.projected&&current.current===current.projected.fact){
   const support=projectionSupport(current);proofs.set(current.current,support.proof);
   lifecycle.projectRevision(channel,current.current,support.proof,index.unresolved()!==0);
  }
  wakeChannel(channel);
 },edge=>nativeMembers.get(edge.child)??lifecycle.initialRequirement(),(edge,occurrence,requirement)=>{
  const slot=slotFor(edge.parent,edge.key,edge.child),fact=nativeFact(requirement);
  const state={present:edge.present,fact};binding.occurrences.set(edge.child,occurrence);
  binding.presence.set(slot,state);binding.completedPresence.set(slot,state);indexSlot(binding,slot);
  return proof=>{ownProofs.set(fact,proof);proofs.set(fact,proof);};
 });
 binding={index,occurrences:new Map(),collections:new Map(),aggregate:context?.aggregate===true,initialized:new Set(),valueInitialized:true,slotTrie:{children:new Map(),slots:new Map()},fields:new Map(),fieldTrie:{children:new Map()},fieldFacts:new Map(),completedFields:new Map(),summary:emptySummary(),releases:[],owner,position,current:baseline,valueFact:baseline,completedValueFact:baseline,valuePayload:context?.value,baselineStructure:baseline,presence:new Map(),completedPresence:new Map(),source,registry:context?.registry,address:context?.address,pending:new Set()};bindings.set(channel,binding);
 if(identity.supported&&source){
  const enroll=(node:object)=>{const occurrence=index.enroll(node);binding.occurrences.set(node,occurrence);return occurrence;};
  enroll(source);
  if(binding.aggregate){
   const seen=new Set<object>();const visit=(candidate:unknown):void=>{
    if(!isTraversableNode(candidate)||seen.has(candidate))return;seen.add(candidate);
    // Every native occurrence enrolls ancestry before its payload adapter branches.
    enroll(candidate);
    if(getEntityPublicationBinding(candidate))return;
    if(isWritableLocation(candidate)){
     const address=getNodeAddress(candidate),relative=address&&context?relativeSourceAddress(context.address,address):undefined;if(!address||relative===undefined)throw Error('Enrolled field has no relative address');
     binding.fields.set(candidate,{address,relative});if(pathValue(binding.valuePayload,relative).present)binding.initialized.add(candidate);
     const requirement=nativeValues.get(candidate)??lifecycle.initialRequirement(),fact=nativeFact(requirement);
     binding.fieldFacts.set(candidate,fact);binding.completedFields.set(candidate,fact);fieldAt(binding.fieldTrie,relative,true)!.field=candidate;
     installFact(binding,candidate,'value',fact,requirement);
     const release=preparePublicationMutations(candidate,(m,input,native)=>prepareScalar(channel,m,input,candidate,native),completeScalar,()=>captureValueInput(channel,candidate));if(release)binding.releases.push(release);return;
    }
    const storage=nodeStoreOf(candidate)??candidate;
    for(const key of Object.getOwnPropertyNames(storage)){
     const descriptor=Object.getOwnPropertyDescriptor(storage,key);if(descriptor&&'value'in descriptor&&isTraversableNode(descriptor.value)&&(getNodeAddress(descriptor.value)||getEntityPublicationBinding(descriptor.value)))visit(descriptor.value);
    }
   };visit(source);
  }else{
   const requirement=nativeValues.get(source)??lifecycle.initialRequirement(),fact=nativeFact(requirement);binding.valueFact=fact;binding.completedValueFact=fact;installFact(binding,source,'value',fact,requirement);
   binding.release=preparePublicationMutations(source,(m,input,native)=>prepareScalar(channel,m,input,undefined,native),completeScalar,()=>captureValueInput(channel));
  }
 }
''' +s[z:]
# readiness in actual admission, not before source reduction
s=s.replace('(bindings.get(channel)?.pending.size??0)>0||decision', '(bindings.get(channel)?.pending.size??0)>0||(bindings.get(channel)?.index.unresolved()??0)>0||decision')
s=s.replace('!bindings.get(channel)?.pending.size&&(fact.clean', '!bindings.get(channel)?.pending.size&&!bindings.get(channel)?.index.unresolved()&&(fact.clean')
s=s.replace('if(lifecycle.isValidating()||bindings.get(channel)?.pending.size)return false;', 'if(lifecycle.isValidating()||bindings.get(channel)?.pending.size||bindings.get(channel)?.index.unresolved())return false;')
s=s.replace('for(const release of b?.watches.values()??[])release();','b?.index.dispose();')
# Old optional experimental field-registration adapter must enroll before accepting facts.
s=s.replace('const address=[...(b.address??[]),...relative];\n b.fields.set', 'const occurrence=b.index.enroll(field);b.occurrences.set(field,occurrence);\n const address=[...(b.address??[]),...relative];\n b.fields.set')
s=s.replace('if(exposed(b,address))adjust(b.summary,own(b.baselineStructure,channel),1);', "installFact(b,field,'value',b.baselineStructure,lifecycle.initialRequirement());")
p.write_text(s)
p=root/'packages/kernel/src/lib/experimental-publication/lifecycle.ts';s=p.read_text().replace('export function projectRevision(channel:object,revision:object,proof:Readonly<Proof>):void','export function projectRevision(channel:object,revision:object,proof:Readonly<Proof>,projectionPending=false):void').replace('op.projectionPending=false;op.proof=proof;', 'op.projectionPending=projectionPending;op.proof=proof;');p.write_text(s)
