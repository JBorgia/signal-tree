from pathlib import Path
p=Path(__file__).parent/'candidate/packages/kernel/src/lib/experimental-publication/private.ts';s=p.read_text().replace('combineTerminalRecords, preparePublicationMutations,','combineTerminalRecords, stagePublicationMutations, preparePublicationMutations,')
pos=s.index('function prepareMembership(edit:MembershipPublicationEdit)')
s=s[:pos]+'''/** Detached descendant plans; registrations become live only with source installation. */
function prepareDescendantEnrollment(channel:object,b:Binding,edit:MembershipPublicationEdit,requirement:lifecycle.NativeRequirement,inspection:boolean) {
 const occurrences=edit.preparedOccurrences;
 if(!occurrences?.length||!b.aggregate)return undefined;
 const fresh=occurrences.filter(value=>!b.occurrences.has(value.source));
 if(!fresh.length)return undefined;
 const fields=fresh.flatMap(value=>{
  const node=value.source;if(!isWritableLocation(node)||getEntityPublicationBinding(node))return [];
  const address=getNodeAddress(node),relative=address&&relativeSourceAddress(b.address??[],address);
  if(!address||relative===undefined)throw Error('Prepared field has no recipient address');
  const fact:Fact=Object.freeze({revision:++serial,clean:false,blockers:[],unknown:false});facts.add(fact);
  const registration=stagePublicationMutations(node,(m,input,native)=>prepareScalar(channel,m,input,node,native),completeScalar,()=>captureValueInput(channel,node));
  return [{node,address,relative,fact,registration}];
 });
 const install={set(){
  for(const field of fields){b.fields.set(field.node,{address:field.address,relative:field.relative});
   b.fieldFacts.set(field.node,field.fact);b.completedFields.set(field.node,field.fact);fieldAt(b.fieldTrie,field.relative,true)!.field=field.node;
   field.registration.install();b.releases.push(field.registration.release);
  }
 }};
 return {record:{writes:[{map:install,key:undefined,value:undefined}],adds:[]},validate:()=>{
  if(bindings.get(channel)?.index!==b.index)throw Error('Dynamic recipient changed during preparation');
 },activate:()=>{
  if(bindings.get(channel)?.index!==b.index)return;
  // Enrollment callbacks write internal proof tables only. No unit is complete yet.
  for(const occurrence of fresh){const handle=b.index.enrollCaptured(occurrence);b.occurrences.set(occurrence.source,handle);}
  for(const field of fields){installFact(b,field.node,'value',field.fact,requirement);if(!inspection)b.initialized.add(field.node);}
  if(inspection){
   const handle=b.occurrences.get(edit.child);if(handle)b.index.setPresence(handle,false,lifecycle.initialRequirement());
   const slot=slotNode(b,[...edit.address,edit.key])?.slots.get(edit.child);
   if(slot){const state={present:false,fact:b.baselineStructure};b.presence.set(slot,state);b.completedPresence.set(slot,state);}
  }
 }};
}
'''+s[pos:]
s=s.replace(" if(meta?.participation==='inspection')return {record:{writes:viewWrites,deletes:edit.present?[{map:viewDomain,key:edit.child}]:[],adds:[]},completion:{parts:[]}};", " const inspection=meta?.participation==='inspection';")
s=s.replace(' physicalView.requirement=native.requirement;', ' if(!inspection)physicalView.requirement=native.requirement;')
s=s.replace('const finalizeRecipients:(()=>void)[]=[];', 'const finalizeRecipients:(()=>void)[]=[];const enrollments:NonNullable<ReturnType<typeof prepareDescendantEnrollment>>[]=[];')
s=s.replace('  const indexed=slotNode(b,address);if(!indexed)continue;const slot=indexed.slots.get(edit.child)??slotFor(edit.branch,edit.key,edit.child);const previous=b.current;', '''  const enrollment=prepareDescendantEnrollment(channel,b,edit,inspection?unavailableInput():native.requirement,inspection);
  if(enrollment){enrollments.push(enrollment);records.push(enrollment.record);finalizeRecipients.push(enrollment.validate);}
  if(inspection)continue;
  const indexed=slotNode(b,address);if(!indexed&&!enrollment)continue;const slot=indexed?.slots.get(edit.child)??slotFor(edit.branch,edit.key,edit.child);const previous=b.current;''')
s=s.replace('changed:(b.presence.get(slot)?.present??true)!==edit.present','changed:(edit.ordinary?.before.present??b.presence.get(slot)?.present??true)!==edit.present')
s=s.replace('{map:indexed.slots,key:edit.child,value:slot}', '{map:{set(){indexSlot(b,slot);}},key:edit.child,value:slot}')
s=s.replace('const record=combineTerminalRecords(...records);return record?{record,completion:{parts},finalize:', '''const record=combineTerminalRecords(...(inspection?[{writes:viewWrites,deletes:edit.present?[{map:viewDomain,key:edit.child}]:[],adds:[]},...enrollments.map(value=>value.record)]:records));return record?{record,completion:{parts,enrollments},finalize:''')
s=s.replace('function completeMembership(completion:object):void{for(const {channel,unit}of(completion as {parts:{channel:object;unit:Unit}[]}).parts)completeScalar({channel,unit});}', '''function completeMembership(completion:object):void{
 const state=completion as {parts:{channel:object;unit:Unit}[];enrollments?:{activate():void}[]};
 for(const enrollment of state.enrollments??[])enrollment.activate();
 state.enrollments=undefined;
 for(const {channel,unit}of state.parts)completeScalar({channel,unit});
}''')
s=s.replace('const slot=slotFor(edge.parent,edge.key,edge.child),fact=nativeFact(requirement);','const slot=slotNode(binding,edge.address)?.slots.get(edge.child)??slotFor(edge.parent,edge.key,edge.child),fact=nativeFact(requirement);')
s=s.replace('binding.presence.set(slot,state);binding.completedPresence.set(slot,state);indexSlot(binding,slot);','if(!binding.presence.has(slot))binding.presence.set(slot,state);if(!binding.completedPresence.has(slot))binding.completedPresence.set(slot,state);indexSlot(binding,slot);')
p.write_text(s)
